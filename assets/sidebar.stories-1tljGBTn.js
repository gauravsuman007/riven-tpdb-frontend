import{i as e}from"./preload-helper-xPQekRTU.js";import{Jn as t,On as n,Qt as r,Rn as i,Xt as a,Yt as o,Zn as s,bt as c,kn as l,o as u,t as d,vt as f}from"./client-CPqmOrbZ.js";import{a as p,i as m,n as h,r as g,t as _}from"./create-runtime-stories-Bf_FwDyw.js";import{n as v,t as y}from"./AppStoreContextDecorator-DPJk3qEj.js";import{n as b,t as x}from"./sidebar-f5saeTdd.js";function S(e,t){l(t,!1),u();var s=E(),c=a(s);w(c,{name:`AdminUser`,asChild:!0,children:(e,t)=>{var n=T();x(o(n),{user:{name:`Alice Admin`,username:`alice`,role:`admin`,image:null}}),i(n),f(e,n)},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<div class="h-screen bg-zinc-950">
    <Sidebar
        user={{
            name: "Alice Admin",
            username: "alice",
            role: "admin",
            image: null
        }} />
</div>`}}});var d=r(c,2);w(d,{name:`RegularUser`,asChild:!0,children:(e,t)=>{var n=T();x(o(n),{user:{name:`Bob Viewer`,username:`bob`,role:`user`,image:null}}),i(n),f(e,n)},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<div class="h-screen bg-zinc-950">
    <Sidebar
        user={{
            name: "Bob Viewer",
            username: "bob",
            role: "user",
            image: null
        }} />
</div>`}}}),w(r(d,2),{name:`Guest`,asChild:!0,children:(e,t)=>{var n=T();x(o(n),{user:void 0}),i(n),f(e,n)},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<div class="h-screen bg-zinc-950">
    <Sidebar user={undefined} />
</div>`}}}),f(e,s),n()}var C,w,T,E,D,O,k,A,j;e((()=>{s(),p(),t(),m(),b(),v(),d(),h(),C={title:`components/Sidebar`,component:x,tags:[`autodocs`],decorators:[()=>({Component:y})],parameters:{layout:`fullscreen`}},{Story:w}=g(C),T=c(`<div class="h-screen bg-zinc-950"><!></div>`),E=c(`<!> <!> <!>`,1),S.__docgen={data:[],name:`sidebar.stories.svelte`},D=_(S,C),O=[`AdminUser`,`RegularUser`,`Guest`],k={...D.AdminUser,tags:[`svelte-csf-v5`]},A={...D.RegularUser,tags:[`svelte-csf-v5`]},j={...D.Guest,tags:[`svelte-csf-v5`]}}))();export{k as AdminUser,j as Guest,A as RegularUser,O as __namedExportsOrder,C as default};