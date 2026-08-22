import{i as e}from"./preload-helper-xPQekRTU.js";import{n as t,r as n}from"./graphql-client-CUI7SPRJ.js";var r,i,a,o,s,c,l,u,d=e((()=>{r=`
    id state imdbId tmdbId tvdbId
    filesystemEntry {
        id fileSize originalFilename downloadUrl
        provider providerDownloadId path plugin rankingProfileName mediaMetadata
    }
    filesystemEntries {
        id fileSize originalFilename downloadUrl
        provider providerDownloadId path plugin rankingProfileName mediaMetadata
    }
    seasons {
        seasonNumber state isRequested
        episodes {
            episodeNumber state
            filesystemEntry {
                id fileSize originalFilename downloadUrl
                provider providerDownloadId path plugin rankingProfileName mediaMetadata
            }
            filesystemEntries {
                id fileSize originalFilename downloadUrl
                provider providerDownloadId path plugin rankingProfileName mediaMetadata
            }
        }
    }
`,i=`
    id fileSize createdAt updatedAt mediaItemId entryType path
    originalFilename downloadUrl plugin provider providerDownloadId
    libraryProfiles mediaMetadata language parentOriginalFilename subtitleContent
    fileHash videoFileSize opensubtitlesId streamId resolution rankingProfileName
`,a=`
    id title fullTitle state imdbId tmdbId tvdbId posterPath
    createdAt updatedAt indexedAt scrapedAt scrapedTimes
    aliases network country language isAnime airedAt year genres rating contentRating
    failedAttempts itemType isRequested showStatus seasonNumber isSpecial parentId
    episodeNumber absoluteNumber runtime itemRequestId activeStreamId
    filesystemEntry {
        ${i}
    }
    filesystemEntries {
        ${i}
    }
    seasons {
        id title seasonNumber isSpecial parentId createdAt updatedAt indexedAt scrapedAt
        scrapedTimes failedAttempts itemType state isRequested
        episodes {
            id title episodeNumber absoluteNumber runtime airedAt parentId createdAt updatedAt
            indexedAt scrapedAt scrapedTimes failedAttempts itemType state isRequested
            filesystemEntry {
                ${i}
            }
            filesystemEntries {
                ${i}
            }
        }
    }
`,o=`
    id state imdbId tmdbId tvdbId
    seasons {
        id seasonNumber state isRequested
        episodes {
            id episodeNumber state
        }
    }
`,`${r}`,`${r}`,`${a}`,`${a}`,`${o}`,`${o}`,s=`subscription {
    movieRequested {
        id tmdbId imdbId requestType state
    }
}`,c=`subscription {
    showRequested {
        id tvdbId imdbId requestType state
    }
}`,l=`subscription {
    showRequestUpdated {
        id tvdbId imdbId requestType state
    }
}`,u=`subscription {
    showIndexed {
        id tvdbId tmdbId imdbId state
    }
}`,`${o}`,`${o}`}));function f(e,n=250){let r=!0,i;function a(){clearTimeout(i),i=setTimeout(()=>{r&&e()},n)}let o=p.map(e=>t(e,void 0,{onData:a,onError:()=>{}}));return()=>{r=!1,clearTimeout(i);for(let e of o)e()}}var p,m=e((()=>{n(),d(),p=[s,c,l,u,`subscription RivenItemScraped {
        itemScraped
    }`,`subscription RivenItemDownloaded {
        itemDownloaded
    }`,`subscription RivenItemFailed {
        itemFailed
    }`,`subscription RivenItemsDeleted {
        itemsDeleted
    }`]}));export{f as n,m as t};