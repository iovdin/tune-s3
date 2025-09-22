const util = require('util')
const mime = require('mime-types');
const nodepath = require('path')
const { S3Client, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } = require("@aws-sdk/client-s3");

const getFileType = (filename) => 
  [".jpg", ".jpeg", ".png", ".webp"].includes(nodepath.extname(filename).toLowerCase()) ? "image" : "text";


async function list({ Bucket, Prefix, Dlimiter, MaxKeys = 1000 }) {
  return await s3.send(new ListObjectsV2Command({ Bucket, Prefix, Delimiter, MaxKeys }));
}

async function getItem({ s3, Bucket, Key }) {
  try {
    const data = await s3.send(new GetObjectCommand({ Bucket, Key }));
    const streamToBuffer = async (stream) =>
      new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (c) => chunks.push(c));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks)));
      });
    const bodyBuffer = await streamToBuffer(data.Body);

    if (getFileType(Key) === "text")
      return bodyBuffer.toString()
    return bodyBuffer
  } catch (e) {
    if (e.message === "Key not found") {
      return
    }
    throw(e)
  }
}

const clientCache = {}

function createS3Middleware({ bucket, mount, path, region, accessKeyId, secretAccessKey, write: enableWrite, endpoint }) {
  async function getS3(ctx) {
    const cacheKey = [bucket, region, accessKeyId, secretAccessKey, endpoint].join("-")
    if(clientCache[cacheKey]) {
      return clientCache[cacheKey]
    }
    let key = accessKeyId;
    if (!key) {
      key = await ctx.read("S3_ACCESS_KEY_ID")
    }
    let secret = secretAccessKey;
    if (!secret) {
      secret = await ctx.read("S3_SECRET_ACCESS_KEY")
    }

    if(!key) {
      throw Error(`accessKeyId is not set`)
    }
    if(!key) {
      throw Error(`secretAccessKey is not set`)
    }

    clientCache[cacheKey] = new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: { accessKeyId: key, secretAccessKey: secret }
    });

    return clientCache[cacheKey] 
  }

  const strip = (prefix, name) => prefix ? name.slice(prefix.length + 1) : name
  async function s3md(name, args) {
    if (mount && name.indexOf(mount) !== 0) {
      return
    }

    const s3 = await getS3(this)
    let rname = name;

    if(mount) {
      rname = strip(mount, name)
    }

    if (path) {
      rname = nodepath.normalize(`${path}/${rname}`)
    }


    let result = []

    // list objects
    if(args.match === "regex") {
      const re = new RegExp(rname)
      const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: rname, MaxKeys: 1000, Delimiter: undefined }))


      result = (res.Contents || [])/*.filter(item => item.Key.match(re))*/.map(item => ({
        type: getFileType(item.Key),
        name: item.Key,
        mimetype: mime.lookup(item.key),
        source: bucket,
        read: async() => getItem({s3, Bucket: bucket, Key: strip(path, item.Key) })
      }))

    } else if (name[name.length-1] === "/") {
      result.push({
        type: "text",
        source: bucket,
        name,
        read: async() => {
          try {
            const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: rname, MaxKeys: 200, Delimiter: "/" }))
            const filelist = (res.Contents || []).map(item => strip(path, item.Key)).join("\n")
            const dirlist = (res.CommonPrefixes || []).map(item => strip(path, item.Prefix)).join("\n")
            if (res.KeyCount > 0) {
              return `Directory '${name}':\n${dirlist}\n${filelist}`
            }
            return `Directory '${name}' is empty`
          }catch (e) {
            throw(e)
          }
        }
      })
    } else {
      const mimetype = mime.lookup(name)

      const value = await getItem({s3, Bucket: bucket, Key: rname })
      
      if (typeof value !== 'undefined') {
        result.push({
          type: getFileType(name),
          source: bucket,
          mimetype,
          name,
          read: async() =>  value
        })
      }
    }

    return (args.output === "all") ? result : result[0];
  }

  async function write(name, data, ctx) {
    if (mount && name.indexOf(mount) !== 0) {
      return
    }
    let rname = strip(mount, name);

    if (path) {
      rname = nodepath.normalize(`${path}/${rname}`)
    }
    const s3 = await getS3(ctx)

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: rname,
      Body: data, 
      ContentType: mime.lookup(rname),
    }));
    return true
  }
  if (enableWrite) {
    return [s3md, write]
  }
  return s3md
}

module.exports = createS3Middleware;
