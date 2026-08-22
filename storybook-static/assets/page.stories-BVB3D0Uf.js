import{i as e}from"./preload-helper-xPQekRTU.js";import{Jn as t,Jt as n,L as r,Lt as i,On as a,Qt as o,Rn as s,Ut as c,Xt as l,Z as ee,Zn as u,a as te,bt as d,cn as f,dt as p,en as m,in as h,jt as g,kn as _,lt as v,nt as y,o as b,on as x,t as S,un as C,vt as w}from"./client-CPqmOrbZ.js";import{I as T,N as E,Y as D}from"./iframe-DG8DOpKj.js";import{a as O,i as k,n as A,r as j,t as M}from"./create-runtime-stories-Bf_FwDyw.js";import{n as ne,t as re}from"./permissions-BVLupCNF.js";import{n as ie,t as ae}from"./activity-card-NFvZKhA3.js";import{n as oe,t as se}from"./downloader-services-grid-CzKW33ny.js";import{n as ce,t as le}from"./kpi-stat-tile-lsARjnHT.js";import{n as N,t as P}from"./library-charts-card-CGnzJv-2.js";import{n as F,t as I}from"./release-year-card-C5GSoLju.js";import{n as L,t as R}from"./service-status-card-i-qjzzu-.js";import{n as z,t as B}from"./usenet-activity-card-DXONBCBe.js";import{r as V,t as H}from"./graphql-client-CUI7SPRJ.js";import{n as U,t as ue}from"./usenet-health-card-caBlrEbe.js";import{n as de,t as fe}from"./usenet-providers-card-Daq4YloO.js";import{n as pe,t as me}from"./watching-now-card-DEr-xIDq.js";import{n as he,t as ge}from"./page-shell-Bn3OUorv.js";import{n as _e,t as ve}from"./riven-live-updates-CeTv9txt.js";function W(e,t){_(t,!0);let u=x(m([])),d=x(m([])),f=x(void 0),v=x(m([])),b=x(null),S=x(m([])),T={healthy:0,unhealthy:0,notIngested:0,unknown:0,total:0},E=x(m(T)),D=x(null),O=C(()=>t.data.services??null),k=C(()=>g(f)?`${g(f).completion_rate.toFixed(2)}%`:`0%`),A=C(()=>[{title:`Total Items`,value:g(f)?.total_items.toLocaleString()},{title:`Completed`,value:g(f)?.states.Completed?.toLocaleString()},{title:`Incomplete`,value:g(f)?.incomplete_items.toLocaleString(),tone:`warning`},{title:`Completion Rate`,value:g(k)}]);function j(e){let t=e.stats;return{total_movies:t.totalMovies,total_shows:t.totalShows,total_seasons:t.totalSeasons,total_episodes:t.totalEpisodes,total_items:t.totalItems,incomplete_items:t.incompleteItems,completion_rate:t.completionRate,states:{Completed:t.completed,Scraped:t.scraped,Indexed:t.indexed,Failed:t.failed,Paused:t.paused,Ongoing:t.ongoing,PartiallyCompleted:t.partiallyCompleted,Unreleased:t.unreleased},activity:e.activity??{},media_year_releases:e.yearReleases??[]}}async function M(){h(f,j(await H(`
        query DashboardStats {
            stats {
                totalMovies
                totalShows
                totalSeasons
                totalEpisodes
                totalItems
                incompleteItems
                completionRate
                completed
                scraped
                indexed
                failed
                paused
                ongoing
                partiallyCompleted
                unreleased
            }
            activity
            yearReleases {
                year
                count
            }
        }
    `)),!0)}c(()=>{let e=!1;return Promise.resolve(t.data.statistics).then(t=>{!e&&t!=null&&h(f,t,!0)}),Promise.resolve(t.data.activePlaybackSessions).then(t=>{e||h(u,t??[],!0)}),Promise.resolve(t.data.downloaderServices).then(t=>{e||h(d,t??[],!0)}),Promise.resolve(t.data.usenetHealth).then(t=>{!e&&t&&(h(v,t.providers??[],!0),h(b,t.streaming??null,!0),h(S,t.titles??[],!0),h(E,t.titleSummary??T,!0),h(D,t.traffic??null,!0))}),()=>{e=!0}}),c(()=>_e(M)),p(()=>{let e=!1,t=window.setInterval(async()=>{try{let t=await H(`
        query {
            activePlaybackSessions {
                server
                userName
                parentTitle
                itemTitle
                itemType
                seasonNumber
                episodeNumber
                playbackState
                playbackMethod
                positionSeconds
                durationSeconds
                deviceName
                clientName
                imageUrl
            }
        }
    `);e||h(u,t.activePlaybackSessions??[],!0)}catch{}try{let t=await H(`
        query {
            nntpProviders {
                host
                port
                priority
                isBackup
                maxConnections
                openConnections
                idleConnections
                activeConnections
                demoted
                consecutiveNotFound
            }
            usenetStreamingHealth {
                caches {
                    name
                    bytesUsed
                    bytesMax
                    entries
                    hits
                    misses
                    hitRate
                }
                cacheHitRate
                fetchesOk
                fetchesFailed
                fetchSuccessRate
                bytesDecoded
                inFlight
                deadSegments
                activeStreams
            }
            usenetTitleHealth {
                infoHash
                fileIndex
                mediaItemId
                status
                totalSegments
                sampledSegments
                missingSegments
                errorSegments
                missingPct
                checkedAt
                repairAttempts
                nextRepairAt
                title
                subtitle
                posterPath
                mediaType
            }
            usenetTitleHealthSummary {
                healthy
                unhealthy
                notIngested
                unknown
                total
            }
            usenetTraffic {
                totalBytesDownloaded
                totalArticlesDownloaded
                providers {
                    host
                    bytesDownloaded
                    articlesDownloaded
                }
                daily {
                    day
                    host
                    bytesDownloaded
                    articlesDownloaded
                }
            }
        }
    `);e||(h(v,t.nntpProviders??[],!0),h(b,t.usenetStreamingHealth??null,!0),h(S,t.usenetTitleHealth??[],!0),h(E,t.usenetTitleHealthSummary??T,!0),h(D,t.usenetTraffic??null,!0))}catch{}},15e3);return()=>{e=!0,window.clearInterval(t)}}),r(`c1luzl`,e=>{i(()=>{n.title=`Dashboard - Riven`})}),ge(e,{class:`mx-auto w-full max-w-7xl`,children:(e,t)=>{var n=K(),r=o(l(n),2);ee(r,21,()=>g(A),e=>e.title,(e,t)=>{le(e,te(()=>g(t)))}),s(r);var i=o(r,2);{let e=C(()=>g(f)?.activity??{});ae(i,{get activity(){return g(e)}})}var a=o(i,2);P(a,{get statistics(){return g(f)}});var c=o(a,2);{let e=C(()=>g(f)?.media_year_releases??[]);I(c,{get data(){return g(e)}})}var p=o(c,2);R(p,{get statuses(){return g(O)}});var m=o(p,2);se(m,{get services(){return g(d)}});var h=o(m,2);me(h,{get sessions(){return g(u)}});var _=o(h,2),x=e=>{var t=G(),n=l(t);fe(n,{get providers(){return g(v)}});var r=o(n,2);B(r,{get health(){return g(b)},get traffic(){return g(D)}}),ue(o(r,2),{get titles(){return g(S)},get summary(){return g(E)}}),w(e,t)};y(_,e=>{g(v).length>0&&e(x)}),w(e,n)},$$slots:{default:!0}}),a()}var G,K,ye=e((()=>{u(),t(),S(),he(),V(),ie(),N(),F(),L(),oe(),pe(),de(),z(),U(),ce(),v(),ve(),G=d(`<!> <!> <!>`,1),K=d(`<header class="border-border/60 border-b pb-6"><h1 class="text-3xl font-bold tracking-tight">Media Library Statistics</h1></header> <section class="grid grid-cols-1 gap-x-10 gap-y-4 py-2 md:grid-cols-2 lg:grid-cols-4"></section> <!> <!> <!> <!> <!> <!> <!>`,1),W.__docgen={data:[{name:`data`,visibility:`public`,keywords:[{name:`required`,description:``}],kind:`let`,type:{kind:`type`,type:`any`,text:`any`},static:!1,readonly:!1}],name:`+page.svelte`}}));function q(e,t){_(t,!1);let n={total_movies:842,total_shows:156,total_seasons:612,total_episodes:11029,total_items:998,incomplete_items:47,completion_rate:95.29,states:{Completed:951,Scraped:8,Indexed:0,Failed:15,Paused:0,Ongoing:12,PartiallyCompleted:0,Unreleased:0},activity:{},media_year_releases:[{year:2022,count:121},{year:2023,count:154},{year:2024,count:178}]},r={user:{id:`1`,name:`Alice`,email:`alice@example.com`},permissions:re(`user`),statistics:Promise.resolve(n),activePlaybackSessions:Promise.resolve([{server:`Plex`,userName:`alice`,parentTitle:`Arcane`,itemTitle:`The Base Violence Necessary for Change`,itemType:`episode`,seasonNumber:2,episodeNumber:5,playbackState:`playing`,playbackMethod:`Direct Play`,positionSeconds:842,durationSeconds:1620,deviceName:`Living Room TV`,clientName:`Plex for Android TV`,imageUrl:null}]),downloaderServices:Promise.resolve([{service:`Real-Debrid`,email:`user@example.com`,username:`rdUser`,premium_status:`premium`,premium_expires_at:`2025-12-31T00:00:00Z`,premium_days_left:120,points:4500,total_downloaded_bytes:0xfa00000000,cooldown_until:null}]),usenetHealth:Promise.resolve({providers:[{host:`news.provider-a.com`,port:563,priority:0,isBackup:!1,maxConnections:50,openConnections:32,idleConnections:8,activeConnections:24,demoted:!1,consecutiveNotFound:0}],streaming:{caches:[{name:`segment-cache`,bytesUsed:4294967296,bytesMax:8589934592,entries:18234,hits:92381,misses:4021,hitRate:.958}],cacheHitRate:.958,fetchesOk:128492,fetchesFailed:342,fetchSuccessRate:.9973,bytesDecoded:549755813888,inFlight:12,deadSegments:8,activeStreams:4},titles:[{infoHash:`abc123`,fileIndex:0,mediaItemId:42,status:`healthy`,totalSegments:500,sampledSegments:50,missingSegments:0,errorSegments:0,missingPct:0,checkedAt:1718e6,repairAttempts:0,nextRepairAt:null,title:`John Wick: Chapter 4`,subtitle:null,posterPath:null,mediaType:`movie`}],titleSummary:{healthy:340,unhealthy:12,notIngested:3,unknown:1,total:356},traffic:{providers:[{host:`news.provider-a.com`,bytesDownloaded:274877906944,articlesDownloaded:89234}],daily:[{day:`2024-06-08`,host:`news.provider-a.com`,bytesDownloaded:42949672960,articlesDownloaded:12043}],totalBytesDownloaded:412316860416,totalArticlesDownloaded:130437}})};b();{let t=f(()=>({data:r}));X(e,{name:`Default`,beforeEach:({msw:e})=>{e.use(J.query(`DashboardStats`,()=>D.json({data:{stats:{totalMovies:n.total_movies,totalShows:n.total_shows,totalSeasons:n.total_seasons,totalEpisodes:n.total_episodes,totalItems:n.total_items,incompleteItems:n.incomplete_items,completionRate:n.completion_rate,completed:951,scraped:8,indexed:0,failed:15,paused:0,ongoing:0,partiallyCompleted:0,unreleased:0},activity:{},yearReleases:n.media_year_releases}})))},get args(){return g(t)},parameters:{__svelteCsf:{rawCode:`<DashboardPage {...args} />`}}})}a()}var J,Y,X,Z,Q,$;e((()=>{u(),O(),t(),k(),ye(),E(),S(),ne(),A(),J=T.link(`/graphql`),Y={title:`pages/Dashboard`,component:W,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:"A static snapshot only: the page polls `ActivePlaybackSessions`/usenet health every 15s and refreshes on a live-update subscription — none of that polling is exercised, just one fixed render seeded from `data` plus a mocked `DashboardStats` query."}}}},{Story:X}=j(Y),q.__docgen={data:[],name:`page.stories.svelte`},Z=M(q,Y),Q=[`Default`],$={...Z.Default,tags:[`svelte-csf-v5`]}}))();export{$ as Default,Q as __namedExportsOrder,Y as default};