# Content Addressable File Storage (CAFS)

## Processing chain

At top-level you have
* an input stream of bytes to be stored
* perhaps a "filename"
* perhaps a mimetype
* some application-level context (we want to be agnostic about this)

You want
* a repository, permanent or expiring
* an address for the stored bytes
* maybe incref/decref semantics
* delete semantics
* a way to query size
* a way to get a stream of the stored bytes
* a way to move between repositories (copy or move)

Expiring
* guaranteed to exist until date-timestamp
* just file-based? trivial table?
* copy out
* move to later date

You don't want
* opinionated metadata structure

An error can happen at any stage, but primarily involving file store

### Upload

Configuration:
* temporary location
* hashing and digest algorithm

Inputs:
* stream
* tag

Processing:
* timestamp
* upload stream to temporary file
* gather content-address, size, upload speed, etc
* validate size
* maybe validate content
* result is payload with filename, content-address, size, etc

### CAFS - move to content-addressable file store

Configuration:
* permanent location
* directory structure (width, depth, etc)

Inputs:
* Processing payload

Processing:
* does it already exist (has to be asked at every step)
* create directy to move it to
* move it to addressable location
* maybe validate content
* result is payload with content-address, size, isDuplicate, artifacts

### CAFS - move to content-addressable file store
