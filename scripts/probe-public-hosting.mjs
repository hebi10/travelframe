import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const buildPublicHostingChecks = ({ privacyUrl, appAdsText }) => {
  const privacy = new URL(privacyUrl);
  if (privacy.protocol !== "https:") {
    throw new Error("Public privacy policy must use HTTPS");
  }
  const origin = privacy.origin;
  return [
    {
      key: "privacy",
      url: privacy.href,
      expected: "바디 프레임",
      mime: "text/html",
      description: "공개 개인정보처리방침"
    },
    {
      key: "delete-account",
      url: new URL("/privacy/photo-guide-delete-account", origin).href,
      expected: ["계정", "삭제"],
      mime: "text/html",
      description: "계정 삭제 안내"
    },
    {
      key: "app-ads",
      url: new URL("/app-ads.txt", origin).href,
      expected: appAdsText.trim(),
      mime: "text/plain",
      exact: true,
      description: "AdMob 게시자 파일"
    }
  ];
};

export const evaluatePublicHostingResponse = (check, response) => {
  if (response.error) return { status: "unverified", reason: response.error };
  if (response.status !== 200) {
    return { status: "unverified", reason: `HTTP ${response.status}` };
  }
  try {
    if (new URL(response.url).origin !== new URL(check.url).origin) {
      return { status: "unverified", reason: "다른 출처로 리디렉션됨" };
    }
  } catch {
    return { status: "unverified", reason: "응답 URL 확인 불가" };
  }
  if (!String(response.contentType).toLowerCase().includes(check.mime)) {
    return { status: "unverified", reason: `MIME 불일치: ${response.contentType || "없음"}` };
  }
  const body = response.body ?? "";
  const expected = Array.isArray(check.expected) ? check.expected : [check.expected];
  const correct = check.exact
    ? body.trim() === check.expected
    : expected.every((keyword) => body.includes(keyword));
  return correct
    ? { status: "verified", reason: "HTTP 200, MIME, 내용 일치" }
    : { status: "unverified", reason: "공개된 문서 내용이 현재 소스 기준과 다름" };
};

const run = async () => {
  const app = JSON.parse(fs.readFileSync("app.json", "utf8"));
  const configUrl = app.expo?.extra?.privacyPolicyUrl;
  const ads = fs.readFileSync("admin/app-ads.txt", "utf8");
  const checks = buildPublicHostingChecks({ privacyUrl: configUrl, appAdsText: ads });
  const rows = [];

  for (const check of checks) {
    let result;
    try {
      const response = await fetch(check.url, {
        signal: AbortSignal.timeout(12000),
        headers: { accept: "text/html,text/plain" }
      });
      result = evaluatePublicHostingResponse(check, {
        status: response.status,
        url: response.url,
        contentType: response.headers.get("content-type"),
        body: await response.text()
      });
    } catch (error) {
      result = evaluatePublicHostingResponse(check, {
        error: error instanceof Error ? error.message : "요청 실패"
      });
    }
    rows.push({ item: check.description, url: check.url, ...result });
    console.log(`${result.status}: ${check.description} (${result.reason})`);
  }

  const markdown = [
    "# 공개 Hosting URL 확인 (읽기 전용)",
    "",
    "| 항목 | 결과 | 검증 설명 |",
    "| --- | --- | --- |",
    ...rows.map((row) =>
      `| ${row.item} | ${row.status} | ${row.reason.replace(/\|/g, "/")} |`
    ),
    "",
    "이 검사는 소스와 공개 사이트를 비교할 뿐 Firebase/AdMob/Play Console 배포·승인 상태를 증명하지 않습니다.",
    ""
  ].join("\n");
  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync("reports/public-hosting-probe.json", JSON.stringify(rows, null, 2) + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  }
  console.log(markdown);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
