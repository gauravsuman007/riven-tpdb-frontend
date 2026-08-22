import{i as e}from"./preload-helper-xPQekRTU.js";import{Ht as t,Jn as n,Ln as r,On as i,Qt as a,Xt as o,Z as s,Zn as c,bt as l,gt as u,jt as d,kn as f,o as p,t as m,vt as h,wt as g,yt as _}from"./client-CPqmOrbZ.js";import{a as v,i as y,n as b,r as x,t as S}from"./create-runtime-stories-Bf_FwDyw.js";import{c as C,f as w,g as T,i as E,m as D,n as O,o as k,t as A,u as j}from"./table-iZ5tdAf_.js";function M(e,n){f(n,!1),p(),P(e,{name:`Default`,asChild:!0,children:(e,n)=>{T(e,{children:(e,n)=>{var i=I(),c=o(i);w(c,{children:(e,t)=>{r(),h(e,g(`A list of recent invoices.`))},$$slots:{default:!0}});var l=a(c,2);E(l,{children:(e,t)=>{O(e,{children:(e,t)=>{var n=I(),i=o(n);k(i,{class:`w-[100px]`,children:(e,t)=>{r(),h(e,g(`Invoice`))},$$slots:{default:!0}});var s=a(i,2);k(s,{children:(e,t)=>{r(),h(e,g(`Status`))},$$slots:{default:!0}});var c=a(s,2);k(c,{children:(e,t)=>{r(),h(e,g(`Method`))},$$slots:{default:!0}}),k(a(c,2),{class:`text-right`,children:(e,t)=>{r(),h(e,g(`Amount`))},$$slots:{default:!0}}),h(e,n)},$$slots:{default:!0}})},$$slots:{default:!0}});var f=a(l,2);D(f,{children:(e,n)=>{var i=_();s(o(i),1,()=>F,e=>e.invoice,(e,n)=>{O(e,{children:(e,i)=>{var s=I(),c=o(s);j(c,{class:`font-medium`,children:(e,i)=>{r();var a=g();t(()=>u(a,d(n).invoice)),h(e,a)},$$slots:{default:!0}});var l=a(c,2);j(l,{children:(e,i)=>{r();var a=g();t(()=>u(a,d(n).status)),h(e,a)},$$slots:{default:!0}});var f=a(l,2);j(f,{children:(e,i)=>{r();var a=g();t(()=>u(a,d(n).method)),h(e,a)},$$slots:{default:!0}}),j(a(f,2),{class:`text-right`,children:(e,i)=>{r();var a=g();t(()=>u(a,d(n).amount)),h(e,a)},$$slots:{default:!0}}),h(e,s)},$$slots:{default:!0}})}),h(e,i)},$$slots:{default:!0}}),C(a(f,2),{children:(e,t)=>{O(e,{children:(e,t)=>{var n=L(),i=o(n);j(i,{colspan:3,children:(e,t)=>{r(),h(e,g(`Total`))},$$slots:{default:!0}}),j(a(i,2),{class:`text-right`,children:(e,t)=>{r(),h(e,g(`$750.00`))},$$slots:{default:!0}}),h(e,n)},$$slots:{default:!0}})},$$slots:{default:!0}}),h(e,i)},$$slots:{default:!0}})},$$slots:{default:!0},parameters:{__svelteCsf:{rawCode:`<Table.Root>
    <Table.Caption>A list of recent invoices.</Table.Caption>
    <Table.Header>
        <Table.Row>
            <Table.Head class="w-[100px]">Invoice</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head>Method</Table.Head>
            <Table.Head class="text-right">Amount</Table.Head>
        </Table.Row>
    </Table.Header>
    <Table.Body>
        {#each invoices as invoice (invoice.invoice)}
            <Table.Row>
                <Table.Cell class="font-medium">{invoice.invoice}</Table.Cell>
                <Table.Cell>{invoice.status}</Table.Cell>
                <Table.Cell>{invoice.method}</Table.Cell>
                <Table.Cell class="text-right">{invoice.amount}</Table.Cell>
            </Table.Row>
        {/each}
    </Table.Body>
    <Table.Footer>
        <Table.Row>
            <Table.Cell colspan={3}>Total</Table.Cell>
            <Table.Cell class="text-right">$750.00</Table.Cell>
        </Table.Row>
    </Table.Footer>
</Table.Root>`}}}),i()}var N,P,F,I,L,R,z,B;e((()=>{c(),v(),n(),y(),A(),m(),b(),N={title:`ui/Table`,component:T,tags:[`autodocs`]},{Story:P}=x(N),F=[{invoice:`INV001`,status:`Paid`,method:`Credit Card`,amount:`$250.00`},{invoice:`INV002`,status:`Pending`,method:`PayPal`,amount:`$150.00`},{invoice:`INV003`,status:`Unpaid`,method:`Bank Transfer`,amount:`$350.00`}],I=l(`<!> <!> <!> <!>`,1),L=l(`<!> <!>`,1),M.__docgen={data:[],name:`table.stories.svelte`},R=S(M,N),z=[`Default`],B={...R.Default,tags:[`svelte-csf-v5`]}}))();export{B as Default,z as __namedExportsOrder,N as default};