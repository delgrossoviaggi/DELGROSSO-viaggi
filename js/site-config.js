/* Configurazione pubblica: non inserire password, token privati o chiavi segrete. */
window.DG_CONFIG={
 brand:'DELGROSSO Viaggi & Limousine Bus',
 contactsReady:true,
 contacts:{phone:'366 212 7916',whatsapp:'366 212 7916',email:'info@delgrossoviaggi.it',address:'',instagram:'https://www.instagram.com/delgrosso_viaggi_/',facebook:'https://www.facebook.com/profile.php?id=61585620590672'},
 contactsExtra:{
  phones:[{name:'Raffaele',number:'320 573 0466'},{name:'Nicola',number:'366 212 7916'}],
  social:[
   {network:'Facebook',label:'DELGROSSO VIAGGI & LIMOUSINE BUS',url:'https://www.facebook.com/profile.php?id=61585620590672'},
   {network:'Facebook',label:'LIMOUSINE BUS',url:'https://www.facebook.com/profile.php?id=61552174581411'},
   {network:'Instagram',label:'DELGROSSO VIAGGI & LIMOUSINE BUS',url:'https://www.instagram.com/delgrosso_viaggi_/'},
   {network:'Instagram',label:'LIMOUSINE BUS',url:'https://www.instagram.com/_LIMOUSINE_BUS/'}
  ]
 },
 privacyReady:false,
 forms:{contactEndpoint:'',newsletterEndpoint:''},
 googleBusinessUrl:'',
 menu:[
  {href:'index.html',it:'Home',en:'Home'},
  {href:'viaggi.html',it:'Viaggi e partenze',en:'Trips & departures'},
  {href:'limousine.html',it:'Limousine Bus',en:'Limousine Bus'},
  {href:'flotta.html',it:'Flotta',en:'Our fleet'},
  {href:'news.html',it:'Blog e news',en:'Blog & news'},
  {href:'contatti.html',it:'Contatti',en:'Contact'},
  {href:'chi-siamo.html',it:'Chi siamo',en:'About us'},
  {href:'admin.html',it:'Area riservata',en:'Staff login'}
 ]
};
document.documentElement.lang=new URLSearchParams(location.search).get('lang')==='en'?'en':'it';
