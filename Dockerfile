# syntax=docker/dockerfile:1

FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o vulnmain .

FROM alpine:3.20
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /app/vulnmain /app/vulnmain
COPY --from=builder /app/config.yml /app/config.yml
COPY --from=builder /app/fonts /app/fonts
RUN mkdir -p /app/uploads/weekly /app/uploads/vuln-images
EXPOSE 5000
CMD ["/app/vulnmain"]
