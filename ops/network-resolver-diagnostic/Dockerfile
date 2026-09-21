FROM alpine:3.20
RUN apk add --no-cache bind-tools
CMD ["sh","-c","set -eu; ip=$(getent ahostsv4 \"$TARGET_HOST\" | awk 'NR==1{print $1}'); test -n \"$ip\"; echo MKETY_TARGET_IPV4=$ip; sleep 30"]
