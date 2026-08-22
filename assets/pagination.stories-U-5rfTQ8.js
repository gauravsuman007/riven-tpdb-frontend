import{i as e}from"./preload-helper-xPQekRTU.js";import{Ht as t,Jn as n,Ln as r,On as i,Qt as a,Xt as o,Z as s,Zn as c,bt as l,cn as u,gt as d,jt as f,kn as p,nt as m,o as h,t as g,vt as _,wt as v,yt as y}from"./client-CPqmOrbZ.js";import{a as b,i as x,n as S,r as C,t as w}from"./create-runtime-stories-Bf_FwDyw.js";import{c as T,f as E,i as D,m as O,n as k,o as A,t as j,u as M}from"./pagination-DEl7j6oF.js";function N(e,n){p(n,!1),h(),F(e,{name:`Default`,asChild:!0,children:(e,n)=>{O(e,{count:120,perPage:10,page:4,children:(e,n)=>{let i=()=>n?.().pages,c=()=>n?.().currentPage;E(e,{children:(e,n)=>{var l=I(),p=o(l);M(p,{children:(e,t)=>{A(e,{})},$$slots:{default:!0}});var h=a(p,2);s(h,1,i,e=>e.key,(e,n)=>{var i=y(),a=o(i),s=e=>{M(e,{children:(e,t)=>{k(e,{})},$$slots:{default:!0}})},l=e=>{M(e,{children:(e,i)=>{{let i=u(()=>c()===f(n).value);T(e,{get page(){return f(n)},get isActive(){return f(i)},children:(e,i)=>{r();var a=v();t(()=>d(a,f(n).value)),_(e,a)},$$slots:{default:!0}})}},$$slots:{default:!0}})};m(a,e=>{f(n).type===`ellipsis`?e(s):e(l,-1)}),_(e,i)}),M(a(h,2),{children:(e,t)=>{D(e,{})},$$slots:{default:!0}}),_(e,l)},$$slots:{default:!0}})},$$slots:{default:!0}})},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<Pagination.Root count={120} perPage={10} page={4}>
    {#snippet children({ pages, currentPage })}
        <Pagination.Content>
            <Pagination.Item>
                <Pagination.PrevButton />
            </Pagination.Item>
            {#each pages as page (page.key)}
                {#if page.type === "ellipsis"}
                    <Pagination.Item><Pagination.Ellipsis /></Pagination.Item>
                {:else}
                    <Pagination.Item>
                        <Pagination.Link {page} isActive={currentPage === page.value}>
                            {page.value}
                        </Pagination.Link>
                    </Pagination.Item>
                {/if}
            {/each}
            <Pagination.Item>
                <Pagination.NextButton />
            </Pagination.Item>
        </Pagination.Content>
    {/snippet}
</Pagination.Root>`}}}),i()}var P,F,I,L,R,z;e((()=>{c(),b(),n(),x(),j(),g(),S(),P={title:`ui/Pagination`,component:O,tags:[`autodocs`]},{Story:F}=C(P),I=l(`<!> <!> <!>`,1),N.__docgen={data:[],name:`pagination.stories.svelte`},L=w(N,P),R=[`Default`],z={...L.Default,tags:[`svelte-csf-v5`]}}))();export{z as Default,R as __namedExportsOrder,P as default};