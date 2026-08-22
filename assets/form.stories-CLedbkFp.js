import{i as e}from"./preload-helper-xPQekRTU.js";import{Jn as t,Ln as n,On as r,Pt as i,Qt as a,Rn as o,Xt as s,Yt as c,Zn as l,_n as u,a as d,bt as f,gn as p,kn as m,o as h,t as g,vn as _,vt as v,wt as y}from"./client-CPqmOrbZ.js";import{a as b,i as x,l as S,o as C,r as w,t as T}from"./adapters-D7zQwd69.js";import{a as E,i as D,n as O,r as k,t as A}from"./create-runtime-stories-Bf_FwDyw.js";import{t as j}from"./button-BmvSoG20.js";import{t as M}from"./button-CwztbjYo.js";import{a as N,d as P,l as F,n as I,o as L,s as R,t as z}from"./form-D3TEpVog.js";import{a as B,i as V}from"./auth-C3TsOG_o.js";import{t as H}from"./input-DGBCLi8-.js";import{t as U}from"./input-C6Zcl4fC.js";function W(e,t){m(t,!1);let l=()=>u(T,`$formData`,f),[f,g]=p(),b=S(C(w(B)),{validators:x(B),SPA:!0}),{form:T}=b;h(),K(e,{name:`Default`,asChild:!0,children:(e,t)=>{var r=Y(),u=c(r);N(u,{get form(){return b},name:`username`,children:(e,t)=>{var r=J(),o=s(r);z(o,{children:(e,t)=>{let r=()=>t?.().props;var o=q(),c=s(o);F(c,{children:(e,t)=>{n(),v(e,y(`Username`))},$$slots:{default:!0}}),H(a(c,2),d(r,{get value(){return l().username},set value(e){_(T,i(l).username=e,i(l))},$$legacy:!0})),v(e,o)},$$slots:{default:!0}});var c=a(o,2);P(c,{children:(e,t)=>{n(),v(e,y(`This is your public display name.`))},$$slots:{default:!0}}),R(a(c,2),{}),v(e,r)},$$slots:{default:!0}});var f=a(u,2);N(f,{get form(){return b},name:`password`,children:(e,t)=>{var r=q(),o=s(r);z(o,{children:(e,t)=>{let r=()=>t?.().props;var o=q(),c=s(o);F(c,{children:(e,t)=>{n(),v(e,y(`Password`))},$$slots:{default:!0}}),H(a(c,2),d(r,{type:`password`,get value(){return l().password},set value(e){_(T,i(l).password=e,i(l))},$$legacy:!0})),v(e,o)},$$slots:{default:!0}}),R(a(o,2),{}),v(e,r)},$$slots:{default:!0}}),j(a(f,2),{type:`submit`,children:(e,t)=>{n(),v(e,y(`Submit`))},$$slots:{default:!0}}),o(r),v(e,r)},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<form class="flex w-full max-w-sm flex-col gap-4">
    <Form.Field {form} name="username">
        <Form.Control>
            {#snippet children({ props })}
                <Form.Label>Username</Form.Label>
                <Input {...props} bind:value={$formData.username} />
            {/snippet}
        </Form.Control>
        <Form.Description>This is your public display name.</Form.Description>
        <Form.FieldErrors />
    </Form.Field>
    <Form.Field {form} name="password">
        <Form.Control>
            {#snippet children({ props })}
                <Form.Label>Password</Form.Label>
                <Input {...props} type="password" bind:value={$formData.password} />
            {/snippet}
        </Form.Control>
        <Form.FieldErrors />
    </Form.Field>
    <Button type="submit">Submit</Button>
</form>`}}}),r(),g()}var G,K,q,J,Y,X,Z,Q;e((()=>{l(),E(),t(),D(),L(),I(),U(),M(),b(),T(),V(),g(),O(),G={title:`ui/Form`,component:N,tags:[`autodocs`]},{Story:K}=k(G),q=f(`<!> <!>`,1),J=f(`<!> <!> <!>`,1),Y=f(`<form class="flex w-full max-w-sm flex-col gap-4"><!> <!> <!></form>`),W.__docgen={data:[],name:`form.stories.svelte`},X=A(W,G),Z=[`Default`],Q={...X.Default,tags:[`svelte-csf-v5`]}}))();export{Q as Default,Z as __namedExportsOrder,G as default};