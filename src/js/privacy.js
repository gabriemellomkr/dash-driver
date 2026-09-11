/* Data rights: an authenticated export and an explicit request through support. */
window.exportMyData = async function() {
 if (!APP_STATE.user) return;
 try {
  const response = await fetch('/api/privacy', {headers:await ddAuthHeaders()});
  if (!response.ok) throw new Error('Não foi possível exportar agora. Tente novamente.');
  const payload = await response.json();
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  const a = document.createElement('a');a.href=url;a.download='dashdriver-meus-dados.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  utils.toast('Seus dados foram exportados. Guarde o arquivo em um local seguro.','success');
 }catch(error){utils.toast(error.message,'error');}
};
window.requestDataHelp = async function() {
 await openSupportModal();renderSupportCreate();
 const select=document.getElementById('support-titulo');
 const option=new Option('Privacidade e exclusão de dados','Privacidade e exclusão de dados',true,true);select.add(option);
 document.getElementById('support-msg').value='Quero solicitar informações, correção ou exclusão dos meus dados. Minha solicitação: ';
 document.getElementById('support-msg').focus();
};
