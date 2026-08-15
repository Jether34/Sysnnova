import { useRef, useCallback } from "react";

const CHOICES = ["A", "B", "C", "D", "E"];

function openPrintWindow(assessment) {
  const total = assessment.item || 20;
  const code = assessment._id ? assessment._id.slice(-6).toUpperCase() : "000000";

  const useDouble = total > 25;
  const rowsPerCol = useDouble ? Math.ceil(total / 2) : total;

  let bD, bF, nF, hF, cF;
  if (total <= 5) { bD = "5.5mm"; bF = "5.5pt"; nF = "8pt"; hF = "7pt"; cF = "6.5pt"; }
  else if (total <= 15) { bD = "4.5mm"; bF = "4.5pt"; nF = "7pt"; hF = "6.5pt"; cF = "6pt"; }
  else if (total <= 25) { bD = "4mm"; bF = "4pt"; nF = "6pt"; hF = "5.5pt"; cF = "5pt"; }
  else if (total <= 35) { bD = "3.2mm"; bF = "3.5pt"; nF = "5.5pt"; hF = "5pt"; cF = "4.5pt"; }
  else if (total <= 45) { bD = "2.8mm"; bF = "3pt"; nF = "5pt"; hF = "4.5pt"; cF = "4pt"; }
  else { bD = "2.5mm"; bF = "2.5pt"; nF = "4.5pt"; hF = "4pt"; cF = "3.5pt"; }

  const dateStr = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const totalItems = total;
  const assessmentStr = JSON.stringify({
    subject: assessment.subject,
    label: assessment.label,
    gradeLevel: assessment.gradeLevel,
    strand: assessment.strand || "",
    section: assessment.section,
    semester: assessment.semester,
    academicYear: assessment.academicYear,
  });

  const w = window.open("", "_blank");
  if (!w) return;

  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Answer Sheet</title>
<style>
@page{size:A4 portrait;margin:0;}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{width:210mm;height:297mm;overflow:hidden;}
body{font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.page{
  width:210mm;height:297mm;padding:5mm;
  display:flex;flex-wrap:wrap;align-content:flex-start;gap:2.5mm;
}
.sh{
  width:calc(50% - 1.25mm);height:calc(33.333% - 1.667mm);
  border:0.5px solid #000;padding:1.5mm;
  display:flex;flex-direction:column;overflow:hidden;
}
.st{font-size:6.5pt;font-weight:bold;text-align:center;margin-bottom:0.3mm;flex-shrink:0;}
.mt{display:flex;justify-content:space-between;color:#333;line-height:1.3;flex-shrink:0;}
.mr{text-align:right;}
.sep{border-top:0.3px solid #aaa;margin:0.3mm 0;flex-shrink:0;}
.nm{display:flex;align-items:center;padding:0.15mm 0;flex-shrink:0;}
.nl{color:#555;margin-right:1mm;}
.nln{flex:1;border-bottom:0.4px solid #888;}
.cols{display:flex;gap:1.5mm;flex:1;min-height:0;overflow:hidden;}
.cols.single .col{width:100%;}
.col{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.colhead{display:flex;padding-left:5mm;margin-bottom:0.2mm;flex-shrink:0;}
.colhead span{flex:1;text-align:center;font-weight:bold;color:#888;}
.row{display:inline-flex;align-items:center;flex-shrink:0;overflow:hidden;}
.num{width:5mm;text-align:right;font-weight:600;color:#000;padding-right:0.5mm;flex-shrink:0;}
.b{
  flex:1;display:inline-flex;align-items:center;justify-content:center;
  border:0.5px solid #000;border-radius:50%;color:#888;line-height:1;
}
.rd{display:inline-block;width:2mm;height:2mm;background:#000;border-radius:50%;flex-shrink:0;}
.rdots{display:flex;justify-content:space-between;align-items:center;padding:0 2mm;flex-shrink:0;}
.rdots.top{margin-bottom:0.3mm;}
.rdots.bottom{margin-top:auto;padding-top:0.3mm;}
.ac{display:flex;justify-content:space-between;align-items:center;flex-shrink:0;margin-top:0.2mm;padding:0 2mm;}
.qcode{font-size:5pt;font-weight:bold;letter-spacing:0.5pt;border:0.5px solid #000;padding:0.2mm 1mm;font-family:monospace;}
.qi{font-size:3.5pt;color:#888;}
@media print{html,body{margin:0;padding:0;border:none;}}
</style></head><body>
<div class="page" id="page"></div>
<script>
var TOTAL=${totalItems};
var USE_DOUBLE=TOTAL>25;
var ROWS_PER_COL=USE_DOUBLE?Math.ceil(TOTAL/2):TOTAL;
var CHOICES=["A","B","C","D","E"];

var SIZE={bD:"5.5mm",bF:"5.5pt",nF:"8pt",hF:"7pt",cF:"6.5pt"};
if(TOTAL>5){SIZE={bD:"4.5mm",bF:"4.5pt",nF:"7pt",hF:"6.5pt",cF:"6pt"};}
if(TOTAL>15){SIZE={bD:"4mm",bF:"4pt",nF:"6pt",hF:"5.5pt",cF:"5pt"};}
if(TOTAL>25){SIZE={bD:"3.2mm",bF:"3.5pt",nF:"5.5pt",hF:"5pt",cF:"4.5pt"};}
if(TOTAL>35){SIZE={bD:"2.8mm",bF:"3pt",nF:"5pt",hF:"4.5pt",cF:"4pt"};}
if(TOTAL>45){SIZE={bD:"2.5mm",bF:"2.5pt",nF:"4.5pt",hF:"4pt",cF:"3.5pt"};}

var A=${assessmentStr};
var CODE="${code}";
var DATE="${dateStr}";

function bRow(n){
  var h='<div class="row"><span class="num" style="font-size:'+SIZE.nF+'">'+n+'</span>';
  for(var c=0;c<5;c++) h+='<span class="b" style="width:'+SIZE.bD+';height:'+SIZE.bD+';font-size:'+SIZE.bF+'">'+CHOICES[c]+'</span>';
  return h+'</div>';
}

function buildCol(s,e){
  var h='<div class="colhead">';
  for(var c=0;c<5;c++) h+='<span style="font-size:'+SIZE.hF+'">'+CHOICES[c]+'</span>';
  h+='</div>';
  for(var i=s;i<e;i++) h+=bRow(i+1);
  return h;
}

function buildGrid(){
  if(USE_DOUBLE) return '<div class="cols"><div class="col">'+buildCol(0,ROWS_PER_COL)+'</div><div class="col">'+buildCol(ROWS_PER_COL,TOTAL)+'</div></div>';
  return '<div class="cols single"><div class="col">'+buildCol(0,TOTAL)+'</div></div>';
}

function buildDots(cls){return '<div class="rdots '+cls+'"><span class="rd"></span><span class="rd"></span><span class="rd"></span><span class="rd"></span><span class="rd"></span></div>';}

function buildSheet(){
  var h='';
  h+=buildDots("top");
  h+='<div class="st">ANSWER SHEET</div>';
  h+='<div class="mt"><div class="ml">';
  h+='<div style="font-size:'+SIZE.cF+'">Subject: '+A.subject+'</div>';
  h+='<div style="font-size:'+SIZE.cF+'">'+A.label+'</div>';
  h+='<div style="font-size:'+SIZE.cF+'">Grade '+A.gradeLevel+(A.strand?'/'+A.strand:'')+' - '+A.section+'</div>';
  h+='</div><div class="mr">';
  h+='<div style="font-size:'+SIZE.cF+'">'+DATE+'</div>';
  h+='<div style="font-size:'+SIZE.cF+'">'+A.semester+'</div>';
  h+='<div style="font-size:'+SIZE.cF+'">S.Y. '+A.academicYear+'</div>';
  h+='</div></div>';
  h+='<div class="sep"></div>';
  h+='<div class="nm"><span class="nl" style="font-size:'+SIZE.cF+'">Name:</span><span class="nln"></span></div>';
  h+='<div class="sep"></div>';
  h+=buildGrid();
  h+=buildDots("bottom");
  h+='<div class="ac"><span class="qcode">'+CODE+'</span><span class="qi">'+TOTAL+' items</span></div>';
  return h;
}

var sheets='';
for(var i=0;i<6;i++) sheets+='<div class="sh">'+buildSheet()+'</div>';
document.getElementById('page').innerHTML=sheets;

setTimeout(function(){
  var sheets=document.querySelectorAll('.sh');
  for(var si=0;si<sheets.length;si++){
    var sh=sheets[si];
    var shH=sh.clientHeight;
    var fixedH=0;
    var children=sh.children;
    var colsEl=null;
    for(var ci=0;ci<children.length;ci++){
      if(children[ci].classList.contains('cols')){colsEl=children[ci];break;}
      fixedH+=children[ci].offsetHeight;
    }
    if(!colsEl) continue;
    var padT=parseFloat(getComputedStyle(sh).paddingTop)||0;
    var padB=parseFloat(getComputedStyle(sh).paddingBottom)||0;
    var colsH=shH-padT-padB-fixedH;
    var cols=colsEl.querySelectorAll('.col');
    for(var cj=0;cj<cols.length;cj++){
      var col=cols[cj];
      var colhead=col.querySelector('.colhead');
      var chH=colhead?colhead.offsetHeight:0;
      var rows=col.querySelectorAll('.row');
      var n=rows.length;
      if(n===0) continue;
      var avail=colsH-chH;
      var rh=Math.floor(avail/n);
      for(var ri=0;ri<n;ri++){
        rows[ri].style.height=rh+'px';
      }
    }
  }
},100);
</script>
</body></html>`);
  w.document.close();
}

export default function AnswerSheetTemplate({ assessment }) {
  return (
    <button onClick={() => openPrintWindow(assessment)} className="btn-outline text-xs">
      <span className="material-symbols-outlined text-sm" aria-hidden="true">print</span> Print Answer Sheet
    </button>
  );
}
