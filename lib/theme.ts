export const THEME_KEY = 'qarevo.theme.v1'
// Static script shared by the server document and client provider; no health data.
export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');document.documentElement.dataset.theme=t==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'};['patient','patient-right','doctor','admin'].forEach(function(r){try{document.documentElement.setAttribute('data-'+r+'-sidebar',localStorage.getItem('qarevo.sidebar.'+r)==='collapsed'?'collapsed':'expanded')}catch(e){}})})()`
