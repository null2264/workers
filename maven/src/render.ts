export const renderHtml = (files: R2Object[], folders: string[], path: string, config: SiteConfig) => {
    return `
    <!DOCTYPE html>
    <html>
        <head>
            <title>${renderTitle(path)}</title>
            <style>
            .listing {
                font-family: monospace;
            }
            .listing table {
                width: 100%;
            }
            .listing td {
                white-space: nowrap;
            }
            .listing th, .listing td {
                text-align: left;
            }
            /*
            .listing td.description {
                width: auto;
            }
            */
            </style>
        </head>
        <body>
        <h1>
            Index of / <a href="/">root</a> / ${renderBreadcrumbs(path)}
        </h1>
        <hr>
        <main>
            <div class="listing">
                <table aria-describedby="summary">
                    <thead>
                    <tr>
                        <th class="hideable"></th>
                        <th class="name">Name</th>
                        <th class="description">Description</th>
                        <th class="size">Size</th>
                        <th class="date hideable">Modified</th>
                        <th class="hideable"></th>
                    </tr>
                    </thead>
                    <tbody>
                    ${path === "/" ? "" : renderGoUp(path)}
                    <!-- folders start -->${renderFolders(folders)}
                    <!-- files start -->${renderFiles(files)}
                    </tbody>
                </table>
            </div>
        </main>
        <hr>
        </body>
    </html>
    `
}


const renderTitle = (path: string) => {
    /*
    const siteTitle = "maven.aap.my.id"
    if (path === "/") {
        return siteTitle
    }
    path = path.slice(0, -1)
    return `${siteTitle} | ${cleanTitle(path)}`
    */
    const prefix = "Index of /"
    if (path === "/") {
        return prefix
    }
    return `${prefix}${cleanTitle(path)}`
}


const cleanTitle = (path: string) => {
    let parts = path.split("/")
    // remove the empty strings
    parts = parts.filter((part) => part !== "")
    return parts[parts.length - 1]
}


const renderBreadcrumbs = (path: string) => {
    const parts = path.split("/")
    var output = ""
    var currentPath = "/"
    for (var i = 0; i < parts.length; i++) {
        if (parts[i] === "") continue
        currentPath += parts[i] + "/"
        output += `<a href="${currentPath}">${parts[i]}</a> / `
    }
    return output
}


var renderGoUp = (path: string) => {
    if (path !== "") {
        return `
        <tr>
            <td class="hideable"></td>
            <td class="goup">
                <a href="..">
                    ../
                </a>
            </td>
            <td class="description">&mdash;</td>
            <td class="size">&mdash;</td>
            <td class="date hideable">&mdash;</td>
            <td class="hideable"></td>
        </tr>
        `
    }
    return ""
}


var renderFolders = (folders: string[]) => {
    if (typeof folders === "undefined") return ""
    var output = ""
    for (var i = 0; i < folders.length; i++) {
        output +=
            `
            <tr class="file ">
                <td class="hideable"></td>
                <td class="name"><a href="/${folders[i]}"><span class="name">${cleanFolderName(folders[i])}/</span></a></td>
                <td class="description">${findDesc("/" + folders[i].slice(0, -1), true) ?? "&mdash;"}</td>
                <td class="size">&mdash;</td>
                <td class="date hideable">&mdash;</td>
                <td class="hideable"></td>
            </tr>
            `
    }
    return output;
};


var renderFiles = (files: R2Object[]) => {
    if (typeof files === "undefined") return ""
    var output = ""
    for (var i = 0; i < files.length; i++) {
        output += 
            `
            <tr class="file ">
                <td class="hideable"></td>
                <td class="name"><a href="/${files[i].key}"><span class="name">${cleanFileName(files[i].key)}</span></a></td>
                <td class="description">${findDesc("/" + files[i].key, true) ?? "&mdash;"}</td>
                <td class="size">${humanFileSize(files[i].size)}</td>
                <td class="date hideable"><time datetime="${files[i].uploaded.toUTCString()}">${files[i].uploaded.toJSON()}</time></td>
                <td class="hideable"></td>
            </tr>
            `
    }
    return output
}


const cleanFileName = (name: string) => {
    return name.split("/").slice(-1).pop()!
}

const cleanFolderName = (name: string) => {
    return name.slice(0, -1).split("/").slice(-1).pop()!
}

// taken from https://stackoverflow.com/questions/10420352/converting-file-size-in-bytes-to-human-readable-string
const humanFileSize = (bytes: number, si = false, dp = 1) => {
    const thresh = si ? 1000 : 1024

    if (Math.abs(bytes) < thresh) {
        return bytes + " B"
    }

    const units = si ? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"] : ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"]
    let u = -1
    const r = 10 ** dp

    do {
        bytes /= thresh
        ++u
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1)

    return bytes.toFixed(dp) + " " + units[u]
}


const desc = {
    "/": "Root",
}


const findDesc = (path: string, exact: boolean): string | undefined => {
    if (exact) {
        return desc[path]
    }
    const keys = Object.keys(desc)
    // find the longest match
    let longestMatch = "/"
    for (const key of keys) {
        if (path.startsWith(key) && key.length > longestMatch.length) {
            longestMatch = key
        }
    }
    return desc[longestMatch]
}
