// Local vector/PNG production graphics; no product screenshot or footage generation.
// Uses the bundled @napi-rs/canvas runtime. App code and dependencies are untouched.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts, loadImage } = require('/Users/shivengarisa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root = path.resolve(import.meta.dirname, '..');
const repo = path.resolve(root, '../..');
const out = path.join(root, 'assets');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(path.join(out, 'licenses'), { recursive: true });
for (const name of ['ArchivoBlack-OFL.txt','RobotoMono-OFL.txt']) fs.copyFileSync(path.join(repo,'assets/fonts',name),path.join(out,'licenses',name));
const faceFiles = [['CPHeading','ArchivoBlack.ttf'],['CPMono','RobotoMono.ttf'],['CPBold','RobotoMonoBold.ttf']];
let faces='';
for (const [alias, file] of faceFiles) {
 const full = path.join(repo, 'assets/fonts', file);
 if (!GlobalFonts.registerFromPath(full, alias)) throw new Error('Font registration failed: ' + file);
 faces += `@font-face{font-family:'${alias}';src:url(data:font/ttf;base64,${fs.readFileSync(full).toString('base64')}) format('truetype');}`;
}
const C = { bg:'#000000', panel:'#111111', ink:'#FFFFFF', secondary:'#C8C8C8', orange:'#FF5A00', yellow:'#FFD400' };
const escape = s => s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const outputs=[];
function graphic(name, width=1920, height=1080, transparent=false) {
 const canvas=createCanvas(width,height), ctx=canvas.getContext('2d');
 const svg=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><style>${faces}</style></defs>`];
 function rect(x,y,w,h,fill=C.bg,stroke=null) {
  ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);}
  svg.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="2"`:''}/>`);
 }
 function text(x,y,value,size=32,family='CPMono',color=C.ink,max=width-x-80){
  ctx.font=`${size}px ${family}`;ctx.fillStyle=color;
  const measured=ctx.measureText(value).width;
  if(measured>max) throw new Error(`${name}: text overflow (${measured}>${max}): ${value}`);
  if(y>height-20||x<0)throw new Error(name+': text outside canvas');
  ctx.fillText(value,x,y);
  svg.push(`<text x="${x}" y="${y}" fill="${color}" font-family="${family}" font-size="${size}">${escape(value)}</text>`);
 }
 function line(points,color=C.orange,dashed=false,arrow=false) {
  ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);
  ctx.strokeStyle=color;ctx.lineWidth=5;ctx.setLineDash(dashed?[12,10]:[]);ctx.stroke();ctx.setLineDash([]);
  svg.push(`<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="5"${dashed?' stroke-dasharray="12 10"':''}/>`);
  if(arrow){const a=points.at(-2),b=points.at(-1),theta=Math.atan2(b[1]-a[1],b[0]-a[0]);const tri=[b,[b[0]-17*Math.cos(theta-.5),b[1]-17*Math.sin(theta-.5)],[b[0]-17*Math.cos(theta+.5),b[1]-17*Math.sin(theta+.5)]];ctx.beginPath();ctx.moveTo(...tri[0]);tri.slice(1).forEach(p=>ctx.lineTo(...p));ctx.closePath();ctx.fillStyle=color;ctx.fill();svg.push(`<polygon points="${tri.map(p=>p.join(',')).join(' ')}" fill="${color}"/>`);}
 }
 function mark(x,y,scale=3){
  rect(x,y,32*scale,32*scale,C.orange);
  for(const [cx,h] of [[12,20],[20,12]]){
   ctx.save();ctx.translate(x+cx*scale,y+16*scale);ctx.rotate(25*Math.PI/180);ctx.fillStyle=C.bg;ctx.fillRect(-2*scale,-h*scale/2,4*scale,h*scale);ctx.restore();
   svg.push(`<rect x="${x+(cx-2)*scale}" y="${y+(16-h/2)*scale}" width="${4*scale}" height="${h*scale}" fill="${C.bg}" transform="rotate(25 ${x+cx*scale} ${y+16*scale})"/>`);
  }
 }
 function header(kicker,title){text(96,112,kicker,28,'CPBold',C.orange);rect(96,148,1728,4,C.orange);text(96,256,title,66,'CPHeading');}
 function footer(value){text(96,height-72,value,24,'CPMono',C.secondary);}
 function save(){svg.push('</svg>');fs.writeFileSync(path.join(out,name+'.svg'),svg.join('\n'));fs.writeFileSync(path.join(out,name+'.png'),canvas.toBuffer('image/png'));outputs.push({name,width,height,transparent});}
 if(!transparent)rect(0,0,width,height,C.bg);
 return {ctx,rect,text,line,mark,header,footer,save};
}
{
 const g=graphic('01_title');g.text(96,118,'CONGRESSIONAL APP CHALLENGE 2026 / TX-04',30,'CPBold',C.orange);g.rect(96,170,1728,4,C.orange);g.mark(96,322,4);g.text(266,438,'CLEARPATH',142,'CPHeading');g.text(96,612,'Official warnings.',66,'CPHeading');g.text(96,704,'Practical preparation.',66,'CPHeading');g.text(96,844,'Texas families / Manas + Shiven',34,'CPMono',C.yellow);g.footer('Actual app demonstration / fictional North Texas scenario');g.save();
}
{
 const g=graphic('02_architecture');g.header('CLEARPATH / CORE WORKFLOW','From warning to preparation');
 const xs=[96,536,976,1416], headings=['NWS / POINT','VALIDATE','EXPLAIN ORDER','HOME / DETAIL'];
 const bodies=[['Official response','Selected point'],['Issue time','Lifecycle'],['Urgency first','Severity next','Then certainty'],['Original context','Guide action']];
 xs.forEach((x,i)=>{g.rect(x,374,408,220,C.panel,C.ink);g.text(x+26,438,headings[i],29,'CPHeading',C.ink,356);bodies[i].forEach((t,j)=>g.text(x+26,500+j*36,t,26,'CPMono',C.secondary,356));if(i<3)g.line([[x+408,484],[xs[i+1],484]],C.orange,false,true);});
 g.rect(96,744,408,190,C.panel,C.yellow);g.text(122,806,'DEMO / FIXTURES',30,'CPHeading',C.yellow,356);g.text(122,861,'Separate source',26,'CPMono',C.ink,356);g.text(122,902,'SIMULATED',26,'CPBold',C.yellow,356);
 g.line([[504,835],[1180,835],[1180,594]],C.yellow,true,true);g.text(550,800,'Independent fixture path',26,'CPMono',C.yellow,600);
 g.line([[1620,594],[1620,744]],C.orange,false,true);g.rect(1416,744,408,190,C.panel,C.ink);g.text(1442,806,'PREPARE',32,'CPHeading');g.text(1442,861,'Bundled guides',26,'CPMono',C.secondary,356);g.text(1442,902,'Kit / plan / contacts',24,'CPMono',C.secondary,356);
 g.footer('Preparation saved locally / separate regional maps / cloud push inactive');g.save();
}
{
 const g=graphic('03_stack');g.header('CLEARPATH / ACTUAL TECHNOLOGIES','Built with');
 const cols=[['MOBILE',['TypeScript','React Native','Expo SDK 57','Expo Router']],['DATA',['NWS alerts','USGS observations','NIFC perimeters','Validated sources']],['STATE',['TanStack Query','AsyncStorage','Bundled guidance','Local fixtures']]];
 cols.forEach(([h,rows],i)=>{const x=96+i*592;g.rect(x,350,544,485,C.panel,C.ink);g.text(x+30,420,h,37,'CPHeading',C.orange,484);rows.forEach((t,j)=>g.text(x+30,505+j*79,t,29,'CPMono',C.ink,484));});
 g.footer('Broader inventory / not every layer is shown in this cut');g.save();
}
{
 const g=graphic('04_roles_ai');g.header('CLEARPATH / ACCURATE CONTRIBUTIONS','Who did what');
 const entries=[['MANAS',['Original concept','Requirements / direction','Implementation review']],['SHIVEN',['Earlier AI-assisted','demo / map / checklist','Four core iPhone checks']]];
 entries.forEach(([h,rows],i)=>{const x=96+i*888;g.rect(x,330,840,328,C.panel,C.ink);g.text(x+32,399,h,44,'CPHeading',C.orange,776);rows.forEach((t,j)=>g.text(x+32,470+j*62,t,32,'CPMono',C.ink,776));});
 g.text(96,754,'CODEX / EXTENSIVE ASSISTANCE',31,'CPBold',C.yellow);g.text(96,820,'Implementation · APIs · maps · fixes · tests',32);g.text(96,882,'Documentation · script · video planning · graphics',32);
 g.footer('Phone checks reported October 14 / no independent-code claim');g.save();
}
{
 const g=graphic('05_end');g.mark(96,174,4);g.text(266,286,'CLEARPATH',100,'CPHeading');g.rect(96,354,1728,4,C.orange);g.text(96,526,'Warnings → preparation.',70,'CPHeading');g.text(96,694,'Manas + Shiven',45,'CPMono',C.yellow);g.text(96,804,'Congressional App Challenge 2026 / TX-04',30);g.footer('AI-assisted implementation / full disclosure in submission');g.save();
}
{
 const g=graphic('06_phone_canvas');
 // Empty left area is for actual phone footage, never a generated product screen.
 g.mark(720,142,2);g.text(814,199,'CLEARPATH',60,'CPHeading');
 g.rect(720,248,1104,4,C.orange);g.text(720,414,'SIMULATED DEMO',60,'CPHeading',C.yellow,1104);
 g.text(720,510,'Fictional North Texas',38,'CPMono',C.ink,1104);g.text(720,568,'training scenario',38,'CPMono',C.ink,1104);
 g.text(720,676,'No current emergency shown.',28,'CPMono',C.secondary,1104);g.save();
}
const labels=[['label_01_simulated','SIMULATED DEMO','Fictional North Texas training scenario',C.yellow],['label_02_order','EXPLAINED DISPLAY ORDER','Not a personal danger prediction',C.orange],['label_03_guide','WARNING → GUIDE','Source and review date shown',C.orange],['label_04_prepare','PREPARE','Kit · family plan · saved contacts',C.orange],['label_05_ai','AI-ASSISTED IMPLEMENTATION','Extensive code, test and video-planning assistance',C.yellow]];
for(const [name,title,body,color] of labels){const g=graphic(name,1120,180,true);g.rect(0,8,1120,164,C.bg);g.rect(0,8,8,164,color);g.text(38,76,title,37,'CPHeading',color,1038);g.text(38,132,body,26,'CPMono',C.ink,1038);g.save();}
const sheet=createCanvas(1280,1224),ctx=sheet.getContext('2d');ctx.fillStyle='#202020';ctx.fillRect(0,0,1280,1224);ctx.font='22px CPMono';ctx.fillStyle=C.ink;ctx.fillText('ClearPath / production graphics / not app screenshots',40,44);
for(let i=0;i<6;i++){const name=outputs[i].name,img=await loadImage(path.join(out,name+'.png'));const x=40+(i%2)*620,y=80+Math.floor(i/2)*376;ctx.drawImage(img,x,y,580,326);ctx.font='17px CPMono';ctx.fillStyle=C.secondary;ctx.fillText(name+'.png',x,y+350);}
// Labels are displayed in a separate stacked preview below to avoid overlapping thumbnails.
const labelSheet=createCanvas(1160,1000),lc=labelSheet.getContext('2d');lc.fillStyle='#222222';lc.fillRect(0,0,1160,1000);
for(let i=0;i<labels.length;i++){const img=await loadImage(path.join(out,labels[i][0]+'.png'));lc.drawImage(img,20,16+i*196,1120,180);}
fs.writeFileSync(path.join(out,'contact_sheet.png'),sheet.toBuffer('image/png'));fs.writeFileSync(path.join(out,'labels_preview.png'),labelSheet.toBuffer('image/png'));
fs.writeFileSync(path.join(out,'asset_manifest.json'),JSON.stringify({preparedDate:'2026-10-21',styleSource:'src/ui/tokens.ts and src/ui/components.tsx Brand',fonts:faceFiles.map(x=>x[1]),assets:outputs,notProductScreenshots:true},null,2)+'\n');
console.log(JSON.stringify({cards:6,featureLabels:5,svgAndPng:true,output:out}));
