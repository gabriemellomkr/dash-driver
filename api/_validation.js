function supportContent(value, type='text') {
 if(typeof value!=='string' || !value.trim()) return null;
 if(type==='text') return value.length<=4000 ? value.trim() : null;
 if(type==='image' && value.length<=1500000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return value;
 return null;
}
const validStatus = status => ['open','in_progress','resolved'].includes(status);
function validOCRImage(value,mime) {
 if(!['image/jpeg','image/png','image/webp'].includes(mime) || typeof value!=='string' || value.length>2800000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
 const bytes=Buffer.from(value,'base64');
 if(mime==='image/png') return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(mime==='image/jpeg') return bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
 return bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP';
}
module.exports={supportContent,validStatus,validOCRImage};
