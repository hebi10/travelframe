export async function cleanupDisposableStagingResources({
  doc,
  file,
  auth,
  uid,
  app,
  deleteApp
}) {
  const tasks = [
    () => doc.delete(),
    () => file.delete({ ignoreNotFound: true }),
    async () => {
      try {
        await auth.deleteUser(uid);
      } catch (error) {
        if (error?.code !== "auth/user-not-found") throw error;
      }
    },
    () => deleteApp(app)
  ];
  const results = await Promise.allSettled(
    tasks.map((task) => Promise.resolve().then(task))
  );
  const failureCount = results.filter((result) => result.status === "rejected").length;
  return { passed: failureCount === 0, failureCount };
}
