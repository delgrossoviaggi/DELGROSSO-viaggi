/* DELGROSSO iPhone Auto Router V10
   Put this as the FIRST script in <head> of GESTIONALE/index.html.
   iPhone/iPod -> iphone.html automatically.
   Desktop/Android/iPad -> normal index.html.
*/
(function(){
  try{
    var ua=navigator.userAgent||'';
    var isIPhone=/iPhone|iPod/i.test(ua);
    var already=/\/iphone\.html$/i.test(location.pathname);
    var bypass=new URLSearchParams(location.search).has('desktop');
    if(isIPhone && !already && !bypass){
      var hash=location.hash||'';
      location.replace('./iphone.html'+hash);
    }
  }catch(e){}
})();