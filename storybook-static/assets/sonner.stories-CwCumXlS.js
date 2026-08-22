import{i as e}from"./preload-helper-xPQekRTU.js";import{Jn as t,Ln as n,On as r,Qt as i,Rn as a,Yt as o,Zn as s,bt as c,kn as l,o as u,t as d,vt as f,wt as p}from"./client-CPqmOrbZ.js";import{a as m,i as h,n as g,r as _,t as v}from"./create-runtime-stories-Bf_FwDyw.js";import{t as y}from"./button-BmvSoG20.js";import{t as b}from"./button-CwztbjYo.js";import{a as x,t as S}from"./dist-C40sr8Ve.js";import{n as C,t as w}from"./sonner-DSpR8ulj.js";function T(e,t){l(t,!1),u(),D(e,{name:`Default`,asChild:!0,children:(e,t)=>{var r=O(),s=o(r);C(s,{});var c=i(s,2),l=o(c);y(l,{variant:`outline`,onclick:()=>x(`Event has been created`),children:(e,t)=>{n(),f(e,p(`Default`))},$$slots:{default:!0}});var u=i(l,2);y(u,{variant:`outline`,onclick:()=>x.success(`Item saved successfully`),children:(e,t)=>{n(),f(e,p(`Success`))},$$slots:{default:!0}});var d=i(u,2);y(d,{variant:`outline`,onclick:()=>x.error(`Something went wrong`),children:(e,t)=>{n(),f(e,p(`Error`))},$$slots:{default:!0}});var m=i(d,2);y(m,{variant:`outline`,onclick:()=>x.info(`A new version is available`),children:(e,t)=>{n(),f(e,p(`Info`))},$$slots:{default:!0}}),y(i(m,2),{variant:`outline`,onclick:()=>x.warning(`Your session is expiring`),children:(e,t)=>{n(),f(e,p(`Warning`))},$$slots:{default:!0}}),a(c),a(r),f(e,r)},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<div>
    <Toaster />
    <div class="flex flex-wrap gap-2">
        <Button variant="outline" onclick={() => toast("Event has been created")}>
            Default
        </Button>
        <Button variant="outline" onclick={() => toast.success("Item saved successfully")}>
            Success
        </Button>
        <Button variant="outline" onclick={() => toast.error("Something went wrong")}>
            Error
        </Button>
        <Button variant="outline" onclick={() => toast.info("A new version is available")}>
            Info
        </Button>
        <Button variant="outline" onclick={() => toast.warning("Your session is expiring")}>
            Warning
        </Button>
    </div>
</div>`}}}),r()}var E,D,O,k,A,j;e((()=>{s(),m(),t(),h(),w(),b(),S(),d(),g(),E={title:`ui/Sonner`,component:C,tags:[`autodocs`]},{Story:D}=_(E),O=c(`<div><!> <div class="flex flex-wrap gap-2"><!> <!> <!> <!> <!></div></div>`),T.__docgen={data:[],name:`sonner.stories.svelte`},k=v(T,E),A=[`Default`],j={...k.Default,tags:[`svelte-csf-v5`]}}))();export{j as Default,A as __namedExportsOrder,E as default};