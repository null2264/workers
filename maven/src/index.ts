import bcrypt from "bcryptjs"
import { Env, User } from "./types"
import { renderHtml } from "./render"

async function listBucket(bucket: R2Bucket, options?: R2ListOptions): Promise<R2Objects> {
    // List all objects in the bucket, launch new request if list is truncated
    const objects: R2Object[] = []
    const delimitedPrefixes: string[] = []

    // delete limit, cursor in passed options
    const requestOptions = {
        ...options,
        limit: undefined,
        cursor: undefined,
    }

    var cursor = undefined
    while (true) {
        const index = await bucket.list({
            ...requestOptions,
            cursor,
        })
        objects.push(...index.objects)
        delimitedPrefixes.push(...index.delimitedPrefixes)
        if (!index.truncated) {
            break
        }
        cursor = index.cursor
    }
    return {
        objects,
        delimitedPrefixes,
        truncated: false,
    }
}

function shouldReturnOriginResponse(originResponse: Response): boolean {
    const dangerousOverwriteZeroByteObject = false

    const isNotEndWithSlash = originResponse.url.slice(-1) !== "/"
    const isNot404 = originResponse.status !== 404
    const isZeroByte = originResponse.headers.get("Content-Length") === "0"
    const overwriteZeroByteObject = dangerousOverwriteZeroByteObject && isZeroByte

    // order matters here
    if (!isNot404) return false;
    if (isNotEndWithSlash) return isNot404;
    return !overwriteZeroByteObject;
}

async function authorize(request: Request, env: Env): Promise<boolean> {
    const authorization = request.headers.get("authorization")

    if (authorization == null || !authorization.startsWith("Basic")) {
        return false
    }

    const split = atob(authorization.substring(6)).split(":")
    const username = split.shift().trim()
    const password = split.join(":").trim()
    const table: User[] = JSON.parse(env.AUTHORIZED_USERS ?? [])

    const user = table.find((user) => user.username === username)
    if (!user) return false


    const isMatched = await bcrypt.compare(password, user.salted_hash)

    return isMatched
}

// TODO: Clear cache when upload/delete is successful
async function _put(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (!await authorize(request, env)) {
        return new Response("Not authorized.", { status: 401 })
    }

    const url = new URL(request.url)
    // Remove leading slash
    const path = url.pathname.substring(1)

    if (request.body == null) {
        return new Response("No body provided.", { status: 400 })
    }

    const key = path.replaceAll("+", " ")
    const bucket = env.BUCKET_maven;
    await bucket.put(key, request.body)

    return new Response("Upload successful.")
}

async function _delete(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (!await authorize(request, env)) {
        return new Response("Not authorized.", { status: 401 })
    }

    const url = new URL(request.url)
    // Remove leading slash
    const path = url.pathname.substring(1)

    const key = path.replaceAll("+", " ")
    const bucket = env.BUCKET_maven;
    await bucket.delete(key)

    return new Response("Delete successful.")
}

async function _get(request: Request, env: Env, ctx: ExecutionContext, isHead: boolean): Promise<Response> {
    const originResponse = await fetch(request)

    const url = new URL(request.url)
    const domain = url.hostname
    const path = url.pathname

    const shouldDecodeURI = true
    // Remove leading slash
    const objectKey = shouldDecodeURI ? decodeURIComponent(path.substring(1)) : path.substring(1)

    if (shouldReturnOriginResponse(originResponse)) {
        return originResponse
    }

    const bucket = env.BUCKET_maven
    const index = await listBucket(
        bucket,
        {
            prefix: objectKey,
            delimiter: "/",
            include: ["httpMetadata", "customMetadata"],
        }
    )
    // filter out key===prefix, appears when dangerousOverwriteZeroByteObject===true
    const files = index.objects.filter((obj) => obj.key !== objectKey)
    const folders = index.delimitedPrefixes.filter((prefix) => prefix !== objectKey)
    // If no object found, return origin 404 response. Only return 404 because if there is a zero byte object,
    // user may want to show a empty folder.
    if (index.objects.length === 0 && index.delimitedPrefixes.length === 0) {
        return new Response(
            `
            <html>
              <head><title>404 Not Found</title></head>
              <body>
                <center><h1>404 Not Found</h1></center>
                <hr><center>${url.hostname}</center>
              </body>
            </html>
            `,
            {
                headers: {
                    "Content-Type": "text/html; charset=utf-8",
                },
                status: 404,
            },
        )
    }
    let parameters = {
        headers: {
            "Content-Type": "text/html; charset=utf-8",
        },
        status: 200,
    }
    if (isHead) {
        return new Response("", parameters)
    }
    return new Response(renderHtml(files, folders, "/" + objectKey), parameters)
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        switch (request.method) {
            case "PUT":
                return _put(request, env, ctx)
            case "DELETE":
                return _delete(request, env, ctx)
            case "HEAD":
            case "GET":
                return _get(request, env, ctx)
            default:
                return new Response("Method Not Allowed", {
                    status: 405,
                    headers: {
                        Allow: "PUT, GET, DELETE",
                    },
                })
        }
    },
}
