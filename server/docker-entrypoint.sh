#!/bin/sh
set -e

# When a named volume is mounted over /app/uploads the volume root may be
# owned by uid 0 inside the container, even though the image layer set it to
# the node user.  Running as root here lets us fix the ownership before
# handing control to the unprivileged node user.
chown node:node /app/uploads

exec su-exec node "$@"
