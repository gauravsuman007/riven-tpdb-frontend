import{i as e}from"./preload-helper-xPQekRTU.js";import{Jn as t,Ln as n,On as r,Qt as i,Rn as a,Xt as o,Yt as s,Zn as c,bt as l,kn as u,o as d,t as f,vt as p,wt as m}from"./client-CPqmOrbZ.js";import{a as h,i as g,n as _,r as v,t as y}from"./create-runtime-stories-Bf_FwDyw.js";import{t as b}from"./button-BmvSoG20.js";import{t as x}from"./button-CwztbjYo.js";import{t as S}from"./label-DJbwqMZR.js";import{t as C}from"./label-DDtXxVZL.js";import{t as w}from"./input-DGBCLi8-.js";import{t as T}from"./input-C6Zcl4fC.js";import{n as E,t as D}from"./form-base-CYQgGzNE.js";function O(e,t){u(t,!1),d();var c=P(),l=o(c);A(l,{name:`Default`,asChild:!0,children:(e,t)=>{var r=M();D(s(r),{title:`Change password`,description:`Update your account password.`,content:e=>{var t=j(),r=s(t);S(r,{for:`password`,children:(e,t)=>{n(),p(e,m(`New password`))},$$slots:{default:!0}}),w(i(r,2),{id:`password`,type:`password`}),a(t),p(e,t)},footer:e=>{b(e,{type:`submit`,children:(e,t)=>{n(),p(e,m(`Save`))},$$slots:{default:!0}})},$$slots:{content:!0,footer:!0}}),a(r),p(e,r)},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<div class="w-full max-w-sm">
    <FormBase title="Change password" description="Update your account password.">
        {#snippet content()}
            <div class="space-y-2">
                <Label for="password">New password</Label>
                <Input id="password" type="password" />
            </div>
        {/snippet}
        {#snippet footer()}
            <Button type="submit">Save</Button>
        {/snippet}
    </FormBase>
</div>`}}}),A(i(l,2),{name:`NoDescription`,asChild:!0,children:(e,t)=>{var n=M();D(s(n),{title:`Passkeys`,content:e=>{p(e,N())},$$slots:{content:!0}}),a(n),p(e,n)},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<div class="w-full max-w-sm">
    <FormBase title="Passkeys">
        {#snippet content()}
            <p class="text-muted-foreground text-sm">No passkeys registered yet.</p>
        {/snippet}
    </FormBase>
</div>`}}}),p(e,c),r()}var k,A,j,M,N,P,F,I,L,R;e((()=>{c(),h(),t(),g(),E(),x(),T(),C(),f(),_(),k={title:`auth/FormBase`,component:D,tags:[`autodocs`]},{Story:A}=v(k),j=l(`<div class="space-y-2"><!> <!></div>`),M=l(`<div class="w-full max-w-sm"><!></div>`),N=l(`<p class="text-muted-foreground text-sm">No passkeys registered yet.</p>`),P=l(`<!> <!>`,1),O.__docgen={data:[],name:`form-base.stories.svelte`},F=y(O,k),I=[`Default`,`NoDescription`],L={...F.Default,tags:[`svelte-csf-v5`]},R={...F.NoDescription,tags:[`svelte-csf-v5`]}}))();export{L as Default,R as NoDescription,I as __namedExportsOrder,k as default};