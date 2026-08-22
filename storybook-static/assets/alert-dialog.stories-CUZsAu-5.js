import{i as e}from"./preload-helper-xPQekRTU.js";import{Jn as t,Ln as n,On as r,Qt as i,Xt as a,Zn as o,a as s,bt as c,kn as l,o as u,t as d,vt as f,wt as p}from"./client-CPqmOrbZ.js";import{a as m,i as h,n as g,r as _,t as v}from"./create-runtime-stories-Bf_FwDyw.js";import{t as y}from"./button-BmvSoG20.js";import{t as b}from"./button-CwztbjYo.js";import{_ as x,a as S,d as C,h as w,l as T,n as E,p as D,r as O,s as k,t as A}from"./alert-dialog-B-fOUYo4.js";function j(e,t){l(t,!1),u(),N(e,{name:`Default`,asChild:!0,children:(e,t)=>{A(e,{children:(e,t)=>{var r=P(),o=a(r);x(o,{child:(e,t)=>{y(e,s(()=>t?.().props,{variant:`outline`,children:(e,t)=>{n(),f(e,p(`Delete account`))},$$slots:{default:!0}}))},$$slots:{child:!0}}),S(i(o,2),{children:(e,t)=>{var r=P(),o=a(r);k(o,{children:(e,t)=>{var r=P(),o=a(r);w(o,{children:(e,t)=>{n(),f(e,p(`Are you absolutely sure?`))},$$slots:{default:!0}}),O(i(o,2),{children:(e,t)=>{n(),f(e,p(`This action cannot be undone. This will permanently delete your account and
                    remove your data from our servers.`))},$$slots:{default:!0}}),f(e,r)},$$slots:{default:!0}}),T(i(o,2),{children:(e,t)=>{var r=P(),o=a(r);C(o,{children:(e,t)=>{n(),f(e,p(`Cancel`))},$$slots:{default:!0}}),D(i(o,2),{children:(e,t)=>{n(),f(e,p(`Continue`))},$$slots:{default:!0}}),f(e,r)},$$slots:{default:!0}}),f(e,r)},$$slots:{default:!0}}),f(e,r)},$$slots:{default:!0}})},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<AlertDialog.Root>
    <AlertDialog.Trigger>
        {#snippet child({ props })}
            <Button {...props} variant="outline">Delete account</Button>
        {/snippet}
    </AlertDialog.Trigger>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
            <AlertDialog.Description>
                This action cannot be undone. This will permanently delete your account and
                remove your data from our servers.
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action>Continue</AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>`}}}),r()}var M,N,P,F,I,L;e((()=>{o(),m(),t(),h(),E(),b(),d(),g(),M={title:`ui/AlertDialog`,component:A,tags:[`autodocs`]},{Story:N}=_(M),P=c(`<!> <!>`,1),j.__docgen={data:[],name:`alert-dialog.stories.svelte`},F=v(j,M),I=[`Default`],L={...F.Default,tags:[`svelte-csf-v5`]}}))();export{L as Default,I as __namedExportsOrder,M as default};