'use strict';
var Promise = require('bluebird');
var _ = require('lodash');
var aws = require('aws-sdk');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
Promise.promisifyAll(fs);

var s3 = new aws.S3();

var distDir = "dist/";
var targetBucket = 'jamiekudla.com';

// Files to ignore.
var ignore = [];

// Derive content type from filename.
function contentType(name) {
    if (path.extname(name) == '.gz')
        name = path.basename(name, path.extname(name));

    switch(path.extname(name)) {
        case '':
        case '.htm':
        case '.html':
            return 'text/html';
        case '.png':
            return 'image/png';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.js':
            return 'text/javascript'
        case '.css':
            return 'text/css'
        case '.svg':
            return 'image/svg+xml'
        default:
            return 'application/octet-stream';
    }
}

// Recursively iterate S3, return promise that resolves to flat list of objecs.
function iterS3(bucket) {
    var keys = [];
    return new Promise(
        function(resolve, reject) {
            var iterPage = (function(marker) {
                s3.listObjects({
                    Bucket: bucket,
                    Marker: marker
                }, function(err, data) {
                    if (err || data == null)
                        reject(err);

                    data.Contents.forEach(function(v) {keys.push(v)})

                    if (data.IsTruncated) {
                        iterPage(data.Contents.slice(-1)[0].Key);
                    } else {
                        resolve(keys);
                    }
                });
            });

            iterPage();
        }
    );
}

// Put file to S3.
function putS3(bucket, key, data) {
    return new Promise(
        function(resolve, reject) {
            s3.putObject({
                Bucket: bucket,
                ACL: 'public-read',
                ContentType: contentType(key),
                Key: key,
                Body: data
            }, function (err, data) {
                if (err)
                    reject(err);
                else
                    resolve(data);
            });
        }
    );
}

// Delete file from S3.
function deleteS3(bucket, key) {
    return new Promise(
        function(resolve, reject) {
            s3.deleteObject({
                Bucket: bucket,
                Key: key
            }, function(err, data) {
                if (err)
                    reject(err);
                else
                    resolve(data);
            });
        }
    );
}

// Recursively iterate fs, return promise that resolves to flat list of files.
function iterFS(dirname) {
    return fs.readdirAsync(dirname).map(function (filename) {
        var fullpath = path.join(dirname, filename);
        return fs.statAsync(fullpath).then(function(stat) {
            if (fullpath in ignore) {
                console.log("Ignoring ", fullpath)
            }
            return stat.isDirectory() ? iterFS(fullpath) : fullpath;
        });
    }).reduce(function (a, b) {
        return a.concat(b);
    }, []);
}

// Entrypoint.
function main() {
    // Clean build directory.
    Promise.all([
        iterS3(targetBucket),
        iterFS(distDir)
    ]).spread(function(s3Files, localFiles) {
        console.log('Uploading...');

        // Upload local files to S3.
        var s3Map = s3Files.reduce(function(a, b) {
            a[b.Key] = b;
            return a
        }, {});

        // Concurrently iterate files, checking hashes to see if they changed.
        return Promise.all(localFiles.map(function(x) {
            return x.substring(distDir.length)
        })).map(function(x) {
            return fs.readFileAsync(distDir + x).then(function(data) {
                var s3hash, localhash;

                if (s3Map[x] !== undefined && s3Map[x].ETag !== undefined)
                    s3hash = JSON.parse(s3Map[x].ETag)

                localhash = crypto.createHash('md5').update(data).digest('hex');

                if (s3hash == localhash) {
                    console.log('Skipping:', x);
                    delete s3Map[x];
                    return;
                }

                console.log('Uploading:', x);
                return putS3(targetBucket, x, data).then(function() {
                    console.log('Uploaded:', x);
                    delete s3Map[x];
                })
            });
        }).then(function() {
            // Return remaining files on S3.
            return s3Map;
        });
    }).then(function(s3Map){
        var extraFiles = _.map(s3Map, function(a,b){return b});

        console.log('Done uploading.');

        if (extraFiles.length == 0)
            return;

        // Print out files on S3 that do not exist locally.
        console.log('Extra files on S3: ' + extraFiles.join(', '));

        return extraFiles;
    }).then(function(extraFiles) {
        if (!extraFiles || !extraFiles.length)
            return;

        // Remove extra files.
        console.log('Removing extra files.');

        return Promise.all(extraFiles).map(function(key) {
            console.log('Removing:', key);
            return deleteS3(targetBucket, key);
        });
    }).then(function() {
        console.log("Done.");
    });
}

main();
