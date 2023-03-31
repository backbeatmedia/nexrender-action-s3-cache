# nexrender-action-s3-cache
 
Cache your template source and assets to a local S3 bucket and use it on future runs, and make available
to other instances rendering the same material

## Installation



## Usage

When creating your render job provide this module in the `predownload` action only. The assets will be permanently cached unless you set up an object lifecycle policy on the bucket, to remove them after a given time.

## Additional Params
The usual S3 parameters are required. The instance role must include permissions to PUT GET and LIST the bucket, and the bucket policy must grant access to the instance. You can include credentials in the `config` element, using the normal AWS format as this is passed through unaltered, however best practice is to use an IAM instance role.

The module confirms that there are entries for `config.region` and `bucket`. 

```js
// job.json
{
    "actions": {
        "predownload": [
            {
                "module": "@nexrender/action-cache",
                "config": {
                    "region": "eu-west-1"
                },
                "bucket": "name-of-bucket",
                "key": 'Key/for/cache/root/' // optional
            }
        ]
    }
}