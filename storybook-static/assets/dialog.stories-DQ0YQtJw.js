import{i as e}from"./preload-helper-xPQekRTU.js";import{Jn as t,Ln as n,On as r,Qt as i,Rn as a,Xt as o,Yt as s,Zn as c,a as l,bt as u,kn as d,o as f,t as p,vt as m,wt as h}from"./client-CPqmOrbZ.js";import{a as g,i as _,n as v,r as y,t as b}from"./create-runtime-stories-Bf_FwDyw.js";import{t as x}from"./button-BmvSoG20.js";import{t as S}from"./button-CwztbjYo.js";import{t as C}from"./label-DJbwqMZR.js";import{t as w}from"./label-DDtXxVZL.js";import{t as T}from"./input-DGBCLi8-.js";import{t as E}from"./input-C6Zcl4fC.js";import{a as D,d as O,l as k,n as A,p as j,r as M,s as N,t as P}from"./dialog-JZrvw2N_.js";function F(e,t){d(t,!1),f(),L(e,{name:`Default`,asChild:!0,children:(e,t)=>{P(e,{children:(e,t)=>{var r=R(),c=o(r);M(c,{child:(e,t)=>{x(e,l(()=>t?.().props,{variant:`outline`,children:(e,t)=>{n(),m(e,h(`Edit Profile`))},$$slots:{default:!0}}))},$$slots:{child:!0}}),N(i(c,2),{children:(e,t)=>{var r=z(),c=o(r);k(c,{children:(e,t)=>{var r=R(),a=o(r);j(a,{children:(e,t)=>{n(),m(e,h(`Edit profile`))},$$slots:{default:!0}}),D(i(a,2),{children:(e,t)=>{n(),m(e,h(`Make changes to your profile here. Click save when you're done.`))},$$slots:{default:!0}}),m(e,r)},$$slots:{default:!0}});var l=i(c,2),u=s(l),d=s(u);C(d,{for:`name`,children:(e,t)=>{n(),m(e,h(`Name`))},$$slots:{default:!0}}),T(i(d,2),{id:`name`,value:`Pedro Duarte`}),a(u);var f=i(u,2),p=s(f);C(p,{for:`username`,children:(e,t)=>{n(),m(e,h(`Username`))},$$slots:{default:!0}}),T(i(p,2),{id:`username`,value:`@peduarte`}),a(f),a(l),O(i(l,2),{children:(e,t)=>{x(e,{type:`submit`,children:(e,t)=>{n(),m(e,h(`Save changes`))},$$slots:{default:!0}})},$$slots:{default:!0}}),m(e,r)},$$slots:{default:!0}}),m(e,r)},$$slots:{default:!0}})},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<Dialog.Root>
    <Dialog.Trigger>
        {#snippet child({ props })}
            <Button {...props} variant="outline">Edit Profile</Button>
        {/snippet}
    </Dialog.Trigger>
    <Dialog.Content>
        <Dialog.Header>
            <Dialog.Title>Edit profile</Dialog.Title>
            <Dialog.Description>
                Make changes to your profile here. Click save when you're done.
            </Dialog.Description>
        </Dialog.Header>
        <div class="grid gap-4 py-4">
            <div class="grid gap-2">
                <Label for="name">Name</Label>
                <Input id="name" value="Pedro Duarte" />
            </div>
            <div class="grid gap-2">
                <Label for="username">Username</Label>
                <Input id="username" value="@peduarte" />
            </div>
        </div>
        <Dialog.Footer>
            <Button type="submit">Save changes</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>`}}}),r()}var I,L,R,z,B,V,H;e((()=>{c(),g(),t(),_(),A(),S(),E(),w(),p(),v(),I={title:`ui/Dialog`,component:P,tags:[`autodocs`]},{Story:L}=y(I),R=u(`<!> <!>`,1),z=u(`<!> <div class="grid gap-4 py-4"><div class="grid gap-2"><!> <!></div> <div class="grid gap-2"><!> <!></div></div> <!>`,1),F.__docgen={data:[],name:`dialog.stories.svelte`},B=b(F,I),V=[`Default`],H={...B.Default,tags:[`svelte-csf-v5`]}}))();export{H as Default,V as __namedExportsOrder,I as default};