import{i as e}from"./preload-helper-xPQekRTU.js";import{Ht as t,Jn as n,Ln as r,On as i,Qt as a,Xt as o,Z as s,Zn as c,bt as l,gt as u,jt as d,kn as f,o as p,t as m,vt as h,wt as g,yt as _}from"./client-CPqmOrbZ.js";import{a as v,i as y,n as b,r as x,t as S}from"./create-runtime-stories-Bf_FwDyw.js";import{c as C,f as w,i as T,n as E,o as D,t as O,u as k}from"./select-CceIxEAl.js";function A(e,n){f(n,!1),p();var c=F(),l=o(c);M(l,{name:`Default`,asChild:!0,children:(e,n)=>{w(e,{type:`single`,value:`apple`,children:(e,n)=>{var i=F(),c=o(i);T(c,{class:`w-[180px]`,children:(e,t)=>{h(e,P())},$$slots:{default:!0}}),D(a(c,2),{children:(e,n)=>{var i=_();s(o(i),1,()=>N,e=>e.value,(e,n)=>{C(e,{get value(){return d(n).value},get label(){return d(n).label},children:(e,i)=>{r();var a=g();t(()=>u(a,d(n).label)),h(e,a)},$$slots:{default:!0}})}),h(e,i)},$$slots:{default:!0}}),h(e,i)},$$slots:{default:!0}})},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<Select.Root type="single" value="apple">
    <Select.Trigger class="w-[180px]">
        <span class="truncate">Apple</span>
    </Select.Trigger>
    <Select.Content>
        {#each fruits as fruit (fruit.value)}
            <Select.Item value={fruit.value} label={fruit.label}>
                {fruit.label}
            </Select.Item>
        {/each}
    </Select.Content>
</Select.Root>`}}}),M(a(l,2),{name:`WithGroupLabel`,asChild:!0,children:(e,n)=>{w(e,{type:`single`,children:(e,n)=>{var i=F(),c=o(i);T(c,{class:`w-[180px]`,children:(e,t)=>{h(e,I())},$$slots:{default:!0}}),D(a(c,2),{children:(e,n)=>{k(e,{children:(e,n)=>{var i=F(),c=o(i);E(c,{children:(e,t)=>{r(),h(e,g(`Fruits`))},$$slots:{default:!0}}),s(a(c,2),1,()=>N,e=>e.value,(e,n)=>{C(e,{get value(){return d(n).value},get label(){return d(n).label},children:(e,i)=>{r();var a=g();t(()=>u(a,d(n).label)),h(e,a)},$$slots:{default:!0}})}),h(e,i)},$$slots:{default:!0}})},$$slots:{default:!0}}),h(e,i)},$$slots:{default:!0}})},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<Select.Root type="single">
    <Select.Trigger class="w-[180px]">
        <span class="truncate">Select a fruit</span>
    </Select.Trigger>
    <Select.Content>
        <Select.Group>
            <Select.GroupHeading>Fruits</Select.GroupHeading>
            {#each fruits as fruit (fruit.value)}
                <Select.Item value={fruit.value} label={fruit.label}>
                    {fruit.label}
                </Select.Item>
            {/each}
        </Select.Group>
    </Select.Content>
</Select.Root>`}}}),h(e,c),i()}var j,M,N,P,F,I,L,R,z,B;e((()=>{c(),v(),n(),y(),O(),m(),b(),j={title:`ui/Select`,component:w,tags:[`autodocs`]},{Story:M}=x(j),N=[{value:`apple`,label:`Apple`},{value:`banana`,label:`Banana`},{value:`blueberry`,label:`Blueberry`},{value:`grapes`,label:`Grapes`},{value:`pineapple`,label:`Pineapple`}],P=l(`<span class="truncate">Apple</span>`),F=l(`<!> <!>`,1),I=l(`<span class="truncate">Select a fruit</span>`),A.__docgen={data:[],name:`select.stories.svelte`},L=S(A,j),R=[`Default`,`WithGroupLabel`],z={...L.Default,tags:[`svelte-csf-v5`]},B={...L.WithGroupLabel,tags:[`svelte-csf-v5`]}}))();export{z as Default,B as WithGroupLabel,R as __namedExportsOrder,j as default};