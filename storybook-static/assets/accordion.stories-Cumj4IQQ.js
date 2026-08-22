import{i as e}from"./preload-helper-xPQekRTU.js";import{Jn as t,Ln as n,On as r,Qt as i,Xt as a,Zn as o,bt as s,kn as c,o as l,t as u,vt as d,wt as f}from"./client-CPqmOrbZ.js";import{a as p,i as m,n as h,r as g,t as _}from"./create-runtime-stories-Bf_FwDyw.js";import{c as v,i as y,n as b,o as x,t as S}from"./accordion-BG7nDEhy.js";function C(e,t){c(t,!1),l();var o=E(),s=a(o);T(s,{name:`Single`,asChild:!0,children:(e,t)=>{v(e,{type:`single`,class:`w-full max-w-md`,children:(e,t)=>{var r=D(),o=a(r);y(o,{value:`item-1`,children:(e,t)=>{var r=E(),o=a(r);b(o,{children:(e,t)=>{n(),d(e,f(`Is it accessible?`))},$$slots:{default:!0}}),x(i(o,2),{children:(e,t)=>{n(),d(e,f(`Yes. It adheres to the WAI-ARIA design pattern.`))},$$slots:{default:!0}}),d(e,r)},$$slots:{default:!0}});var s=i(o,2);y(s,{value:`item-2`,children:(e,t)=>{var r=E(),o=a(r);b(o,{children:(e,t)=>{n(),d(e,f(`Is it styled?`))},$$slots:{default:!0}}),x(i(o,2),{children:(e,t)=>{n(),d(e,f(`Yes. It comes with default styles that match the theme.`))},$$slots:{default:!0}}),d(e,r)},$$slots:{default:!0}}),y(i(s,2),{value:`item-3`,children:(e,t)=>{var r=E(),o=a(r);b(o,{children:(e,t)=>{n(),d(e,f(`Is it animated?`))},$$slots:{default:!0}}),x(i(o,2),{children:(e,t)=>{n(),d(e,f(`Yes. It's animated by default, but you can disable it if you prefer.`))},$$slots:{default:!0}}),d(e,r)},$$slots:{default:!0}}),d(e,r)},$$slots:{default:!0}})},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<Accordion.Root type="single" class="w-full max-w-md">
    <Accordion.Item value="item-1">
        <Accordion.Trigger>Is it accessible?</Accordion.Trigger>
        <Accordion.Content>
            Yes. It adheres to the WAI-ARIA design pattern.
        </Accordion.Content>
    </Accordion.Item>
    <Accordion.Item value="item-2">
        <Accordion.Trigger>Is it styled?</Accordion.Trigger>
        <Accordion.Content>
            Yes. It comes with default styles that match the theme.
        </Accordion.Content>
    </Accordion.Item>
    <Accordion.Item value="item-3">
        <Accordion.Trigger>Is it animated?</Accordion.Trigger>
        <Accordion.Content>
            Yes. It's animated by default, but you can disable it if you prefer.
        </Accordion.Content>
    </Accordion.Item>
</Accordion.Root>`}}}),T(i(s,2),{name:`Multiple`,asChild:!0,children:(e,t)=>{v(e,{type:`multiple`,class:`w-full max-w-md`,children:(e,t)=>{var r=E(),o=a(r);y(o,{value:`item-1`,children:(e,t)=>{var r=E(),o=a(r);b(o,{children:(e,t)=>{n(),d(e,f(`First section`))},$$slots:{default:!0}}),x(i(o,2),{children:(e,t)=>{n(),d(e,f(`Multiple items can be open at the same time.`))},$$slots:{default:!0}}),d(e,r)},$$slots:{default:!0}}),y(i(o,2),{value:`item-2`,children:(e,t)=>{var r=E(),o=a(r);b(o,{children:(e,t)=>{n(),d(e,f(`Second section`))},$$slots:{default:!0}}),x(i(o,2),{children:(e,t)=>{n(),d(e,f(`Try opening this one too.`))},$$slots:{default:!0}}),d(e,r)},$$slots:{default:!0}}),d(e,r)},$$slots:{default:!0}})},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<Accordion.Root type="multiple" class="w-full max-w-md">
    <Accordion.Item value="item-1">
        <Accordion.Trigger>First section</Accordion.Trigger>
        <Accordion.Content>Multiple items can be open at the same time.</Accordion.Content>
    </Accordion.Item>
    <Accordion.Item value="item-2">
        <Accordion.Trigger>Second section</Accordion.Trigger>
        <Accordion.Content>Try opening this one too.</Accordion.Content>
    </Accordion.Item>
</Accordion.Root>`}}}),d(e,o),r()}var w,T,E,D,O,k,A,j;e((()=>{o(),p(),t(),m(),S(),u(),h(),w={title:`ui/Accordion`,component:v,tags:[`autodocs`]},{Story:T}=g(w),E=s(`<!> <!>`,1),D=s(`<!> <!> <!>`,1),C.__docgen={data:[],name:`accordion.stories.svelte`},O=_(C,w),k=[`Single`,`Multiple`],A={...O.Single,tags:[`svelte-csf-v5`]},j={...O.Multiple,tags:[`svelte-csf-v5`]}}))();export{j as Multiple,A as Single,k as __namedExportsOrder,w as default};