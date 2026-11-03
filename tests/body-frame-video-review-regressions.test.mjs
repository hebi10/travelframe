import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const compile = (code, fileName='module.ts') => ts.transpileModule(code, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const load = (path, modules={}) => {
  const exports={};
  vm.runInNewContext(compile(fs.readFileSync(path,'utf8'),path), { exports, require: name => { assert.ok(modules[name],name); return modules[name]; }, setTimeout, clearTimeout, Error });
  return exports;
};
const helpers=load('lib/body-frame-video-export.ts');
const videoModel=load('lib/body-frame-video.ts');
const limits=load('lib/local-library-limit.ts');
const source=fs.readFileSync('features/trip-clip/BodyFrameVideoScreen.tsx','utf8');
const ast=ts.createSourceFile('screen.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const callbacks={};
function visit(node) {
  if(ts.isVariableDeclaration(node) && ['createVideo','recordProjectVideo'].includes(node.name.getText(ast))) callbacks[node.name.getText(ast)]=node.initializer.arguments[0].getText(ast);
  ts.forEachChild(node,visit);
}
visit(ast);
let failures=0;
async function check(name,fn) { try { await fn(); console.log(`ok - ${name}`); } catch(error) { failures++; console.error(`not ok - ${name}: ${error.stack}`); } }

await check('missing primary with valid original fallback persists real cover before staging cleanup',async()=>{
  const files=new Map(); const storage=new Map(); const copied=[]; const deleted=[];
  const FileSystem={cacheDirectory:'file:///cache/',documentDirectory:'file:///documents/',
    makeDirectoryAsync:async()=>{},
    getInfoAsync:async uri=>({exists:files.has(uri),isDirectory:false,size:files.get(uri)?.length??0}),
    copyAsync:async ({from,to})=>{ if(!files.has(from))throw Error(`missing source ${from}`); files.set(to,files.get(from)); copied.push([from,to]); },
    deleteAsync:async uri=>{ deleted.push(uri); for(const path of files.keys())if(path===uri||path.startsWith(uri))files.delete(path); }
  };
  const downloadPrivateFile=async (uri,to)=>{ assert.equal(uri,'https://original/A'); files.set(to,'verified-original'); return {uri:to}; };
  const library=load('lib/video-library.ts',{
    'expo-file-system/legacy':FileSystem,
    '@/lib/private-storage':{downloadPrivateFile},
    '@/lib/local-storage':{localStorageAdapter:{getItem:async key=>storage.get(key)??null,setItem:async(key,value)=>storage.set(key,value)}},
    '@/lib/local-library-limit':limits,
    '@/lib/trip-clip-title':{TRIP_CLIP_TITLE_PREFIX:'영상',getNextTripClipTitle:()=> '영상 1'}
  });
  let encoded=0; const overlays=[];
  const context={...helpers,...videoModel,FileSystem,downloadPrivateFile,
    activeProject:{id:'project',name:'기록'},projectPhotos:[{id:'A',uri:'file:///missing.jpg',downloadURL:'https://original/A',width:3,height:4}],previewPhoto:{uri:'file:///missing.jpg'},
    isExporting:false,exportController:{current:null},AbortController,isLoggedIn:true,guestUsage:null,
    planEntitlements:{canExportVideo:true,localVideoLimit:30},videoLimitState:{allowed:true},videoOptions:{ratio:'3:4',interval:0.1},durations:{A:0.1},totalDuration:0.1,
    recordingViewAvailable:true,totalFrames:3,outputSize:{width:1080,height:1440},BODY_FRAME_VIDEO_BITRATE:5_000_000,
    imageReadiness:{current:null},createBodyFrameImageReadiness:()=>({wait:async()=>{}}),
    setRecordingPhotos:()=>{},setRecordingRunId:()=>{},setRecordingFrameIndex:()=>{},setExportProgress:()=>{},setIsExporting:()=>{},setAlbumRetryUri:()=>{},setGuestUsage:()=>{},
    setMessage:message=>overlays.push(message),cancelPostSaveAd:()=>{},requestPostSaveAd:()=>{},
    waitForPaint:async()=>{},toNativeFilePath:uri=>uri.replace('file://',''),toFileUri:path=>`file://${path}`,
    recorder:{record:async options=>{encoded++;const uri=`file://${options.output}`;files.set(uri,'encoded-video');return options.output;}},
    getMadeVideos:library.getMadeVideos,saveMadeVideo:library.saveMadeVideo,saveVideoToLibrary:async uri=>{assert.ok(files.has(uri));},assertLocalLibraryCapacity:limits.assertLocalLibraryCapacity,
    getUserFacingErrorMessage:error=>error.message,formatDuration:value=>`${value}초`
  };
  context.recordProjectVideo=vm.runInNewContext(compile(`(${callbacks.recordProjectVideo})`),context);
  const create=vm.runInNewContext(compile(`(${callbacks.createVideo})`),context);
  await create();
  assert.equal(encoded,1);
  const videos=await library.getMadeVideos();
  assert.equal(videos.length,1,`valid video must persist despite missing primary URI: ${overlays.at(-1)}`);
  assert.equal(files.get(videos[0].coverUri),'verified-original');
  assert.ok(copied.some(([from,to])=>from.includes('body-frame-export-')&&to.endsWith('-cover.jpg')),'cover is copied from verified staging');
  assert.equal([...files.keys()].some(path=>path.includes('body-frame-export-')),false,'staging is removed after cover persistence');
  let finishNative; let nativeStarted;
  const started=new Promise(resolve=>{nativeStarted=resolve;});
  context.recorder.record=options=>new Promise(resolve=>{
    finishNative=()=>{files.set(`file://${options.output}`,'aborted-video');resolve(options.output);};
    nativeStarted();
  });
  const controller=new AbortController();
  let settled=false;
  const work=context.recordProjectVideo(controller.signal).finally(()=>{settled=true;});
  await started;
  controller.abort();
  for(let i=0;i<5;i++)await Promise.resolve();
  assert.equal(settled,false,'real screen handler remains pending during native teardown');
  assert.equal([...files.keys()].some(path=>path.includes('body-frame-export-')),true,'do not delete originals while native may still reference them');
  finishNative();
  await assert.rejects(work,/취소/);
  assert.equal([...files.keys()].some(path=>path.includes('body-frame-export-')),false,'cleanup follows actual native settlement');
});

await check('cancelled native session holds lock and resources until underlying encoder settles',async()=>{
  assert.equal(typeof helpers.runBodyFrameNativeRecording,'function');
  let finishNative; let settled=false;
  const controller=new AbortController();
  const native=new Promise(resolve=>{finishNative=resolve;});
  const work=helpers.runBodyFrameNativeRecording(()=>native,controller.signal,1000).finally(()=>{settled=true;});
  controller.abort();
  for(let i=0;i<5;i++)await Promise.resolve();
  assert.equal(settled,false,'abort must not release staging/session before native settles');
  await assert.rejects(helpers.runBodyFrameNativeRecording(async()=> 'overlap',new AbortController().signal,1000),/이전.*종료/);
  finishNative('/aborted.mp4');
  await assert.rejects(work,/취소/);
  assert.equal(await helpers.runBodyFrameNativeRecording(async()=>'/next.mp4',new AbortController().signal,1000),'/next.mp4');
  let finishTimedOut; let timedOutSettled=false;
  const timedOutNative=new Promise(resolve=>{finishTimedOut=resolve;});
  const timedOut=helpers.runBodyFrameNativeRecording(()=>timedOutNative,undefined,5).finally(()=>{timedOutSettled=true;});
  await new Promise(resolve=>setTimeout(resolve,15));
  assert.equal(timedOutSettled,false,'timeout also keeps the session until actual native settlement');
  await assert.rejects(helpers.runBodyFrameNativeRecording(async()=> 'overlap'),/이전.*종료/);
  finishTimedOut('/timed-out.mp4');
  await assert.rejects(timedOut,/시간/);
});

await check('preview scales the same 360 logical canvas for long overlays at every position and watermark state',async()=>{
  assert.equal(typeof videoModel.getBodyFrameVideoPreviewTransform,'function');
  const jsx=(type,props,key)=>({type,props,key});
  const canvas=load('components/trip-clip-recording-canvas.tsx',{
    'react/jsx-runtime':{jsx,jsxs:jsx},'@/components/private-media-image':{Image:'Image'},
    'react-native':{StyleSheet:{create:value=>value,absoluteFillObject:{}},Text:'Text',View:'View'},
    '@/components/camera-guide-overlay':{CameraGuideOverlay:'Guide'},'@/constants/app-theme':{colors:{ink:'#000',inverse:'#fff'}},
    '@/lib/trip-clip-photo-adjustment':{getTripClipPhotoAdjustment:()=>({translateX:0,translateY:0,scale:1})}
  }).TripClipRecordingCanvas;
  const text='2026.11.03 · 80.0kg · 아주 긴 기록 텍스트를 두 줄에 걸쳐 표시합니다 '.repeat(2);
  const props={frame:{currentPhoto:{id:'A',uri:'file://A',width:3,height:4},nextPhoto:null,transitionProgress:0},template:'minimal',transition:'none',frameAspectRatio:0.75,photoAdjustments:{},bodyFrameOverlayText:text};
  const findText=(node,target)=>{
    if(!node||typeof node!=='object')return null;
    if(Array.isArray(node))return node.map(item=>findText(item,target)).find(Boolean);
    return node.props?.children===target?node:findText(node.props?.children,target);
  };
  for(const width of [180,260,320])for(const position of ['top-left','top-right','bottom-left','bottom-right'])for(const showWatermark of [false,true]){
    const transform=videoModel.getBodyFrameVideoPreviewTransform(width,0.75,360);
    assert.equal(transform.width,360);assert.equal(transform.height,480);
    assert.equal(transform.transform[0].scale,width/360);assert.equal(transform.transformOrigin,'top left');
    const preview=canvas({...props,showWatermark,bodyFrameOverlayPosition:position});
    const output=canvas({...props,showWatermark,bodyFrameOverlayPosition:position});
    const previewText=findText(preview,text);const outputText=findText(output,text);
    assert.equal(previewText.props.numberOfLines,2);
    assert.equal(JSON.stringify(previewText.props),JSON.stringify(outputText.props),'logical typography, wrapping bounds, and positions are identical before whole-canvas scaling');
    assert.equal(Boolean(findText(preview,'바디 프레임')),showWatermark);
  }
  assert.match(source,/getBodyFrameVideoPreviewTransform\(previewWidth, frameAspectRatio, RECORDING_VIEW_WIDTH\)/,'screen must apply the tested logical transform');
});
if(failures)throw Error(`${failures} review regressions`);
