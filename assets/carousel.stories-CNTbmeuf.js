import{i as e}from"./preload-helper-xPQekRTU.js";import{Jn as t,On as n,Q as r,Qt as i,Rn as a,Xt as o,Yt as s,Z as c,Zn as l,bt as u,kn as d,o as f,t as p,vt as m,yt as h}from"./client-CPqmOrbZ.js";import{a as g,i as _,n as v,r as y,t as b}from"./create-runtime-stories-Bf_FwDyw.js";import{c as x,i as S,n as C,o as w,t as T,u as E}from"./carousel-D5eBqff3.js";function D(e,t){d(t,!1),f(),k(e,{name:`Default`,asChild:!0,children:(e,t)=>{E(e,{class:`w-full max-w-xs`,children:(e,t)=>{var n=j(),l=o(n);x(l,{children:(e,t)=>{var n=h();c(o(n),0,()=>[,,,,,],r,(e,t,n)=>{w(e,{children:(e,t)=>{var r=A(),i=s(r);i.textContent=n+1,a(r),m(e,r)},$$slots:{default:!0}})}),m(e,n)},$$slots:{default:!0}});var u=i(l,2);S(u,{}),C(i(u,2),{}),m(e,n)},$$slots:{default:!0}})},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<Carousel.Root class="w-full max-w-xs">
    <Carousel.Content>
        {#each Array(5) as _, i (i)}
            <Carousel.Item>
                <div
                    class="border-border bg-card flex aspect-square items-center justify-center rounded-lg border">
                    <span class="text-4xl font-semibold">{i + 1}</span>
                </div>
            </Carousel.Item>
        {/each}
    </Carousel.Content>
    <Carousel.Previous />
    <Carousel.Next />
</Carousel.Root>`}}}),n()}var O,k,A,j,M,N,P;e((()=>{l(),g(),t(),_(),T(),p(),v(),O={title:`ui/Carousel`,component:E,tags:[`autodocs`],parameters:{layout:`centered`}},{Story:k}=y(O),A=u(`<div class="border-border bg-card flex aspect-square items-center justify-center rounded-lg border"><span class="text-4xl font-semibold"></span></div>`),j=u(`<!> <!> <!>`,1),D.__docgen={data:[],name:`carousel.stories.svelte`},M=b(D,O),N=[`Default`],P={...M.Default,tags:[`svelte-csf-v5`]}}))();export{P as Default,N as __namedExportsOrder,O as default};