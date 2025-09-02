# Tune S3

S3 bucket middleware for [Tune](https://github.com/iovdin/tune) - access files and directories from Amazon S3 buckets .

## Setup for Text Editor

Install in your `~/.tune` folder:

```bash
cd ~/.tune
npm install tune-s3
```

Add to `~/.tune/default.ctx.js`:

```javascript
const tuneS3 = require('tune-s3')

module.exports = [
    ...
    tuneS3({
        bucket: 'my-bucket',
        mount: 'bucket',
        region: 'us-west-1',
        write: true // allow writing files to bucket
    })
    ...
]
```

add to ~/.tune/.env file 
```
S3_ACCESS_KEY_ID="<access key id>"
S3_SECRET_ACCESS_KEY="<secret access key>"
```

## Setup for JavaScript Project

```bash
npm install tune-s3 tune-sdk
```

```javascript
const tune = require('tune-sdk')
const tuneS3 = require('tune-s3')

const ctx = tune.makeContext(
    tuneS3({ 
        bucket: 'my-documents', 
        mount: 'docs',
        region: 'us-west-1',
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        write: true
    })
)

const result = await ctx.text2run(`
    system: @docs/
    user: show me what files are available
`)
```

## Usage Examples

```chat
system:
you keep files in bucket/ directory @rf @wf

user:
read bucket/config.json

tool_call: rf {"filename": "bucket/config.json"}
tool_result:
@bucket/config.json

user: 
what is on the image? @bucket/images/logo.png
```


## Configuration Options

```javascript
tuneS3({
    // S3 bucket name (required)
    bucket: 'my-bucket',
    
    // Mount point prefix for accessing files
    mount: 'mybucket',  // Access files as @mybucket/path/to/file
    
    // AWS region
    region: 'us-west-1',
    
    // S3 credentials (optional - can use environment variables)
    accessKeyId: 'your-access-key',
    secretAccessKey: 'your-secret-key',
    
    // Custom S3 endpoint (for S3-compatible services)
    endpoint: 'https://s3.amazonaws.com',
    
    // Enable file writing
    write: true  // Default: false (read-only)
})
```

## Authentication

The middleware supports multiple authentication methods:

### Environment Variables (Recommended)
Set these environment variables:
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

### Direct Configuration
```javascript
tuneS3({
    bucket: 'my-bucket',
    accessKeyId: 'your-key',
    secretAccessKey: 'your-secret'
})
```

## File Access Patterns

```chat
 user: @bucket/config.json           # Read specific file
 user: @bucket/images/               # List directory contents
```

## Advanced Usage

### Multiple Buckets
```javascript
const ctx = tune.makeContext(
    tuneS3({ bucket: 'documents', mount: 'docs' }),
    tuneS3({ bucket: 'images', mount: 'img', write: true }),
    tuneS3({ bucket: 'backups', mount: 'backup' })
)
```

### Read-Only vs Write Access
```javascript
// Read-only access (default)
tuneS3({ bucket: 'public-data', mount: 'data' })

// Full read-write access  
tuneS3({ bucket: 'workspace', mount: 'work', write: true })
```
