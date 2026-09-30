FROM alpine:3.20
RUN apk add --no-cache bind-tools && addgroup -S diagnostic && adduser -S -G diagnostic diagnostic
USER diagnostic
HEALTHCHECK --interval=10s --timeout=5s --retries=2 CMD getent ahostsv4 "$TARGET_HOST" >/dev/null
CMD ["sh","-c","set -eu; ip=$(getent ahostsv4 \"$TARGET_HOST\" | awk 'NR==1{print $1}'); test -n \"$ip\"; echo MKETY_TARGET_IPV4=$ip; sleep 30"]
