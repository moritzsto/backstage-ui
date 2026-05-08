#!/bin/bash

set -e
set -x

# BACKEND_IP=72.62.106.70
# SSH_KEY=~/.ssh/hostinger_vps
# SSH_USER=root
# SSH_PORT=50022
BACKEND_IP=54.174.79.32
SSH_KEY=~/.ssh/backstage-test.pem
SSH_USER=ec2-user
SSH_PORT=22

yarn tsc

yarn build:backend

docker image build . -f packages/backend/Dockerfile --tag backstage

docker image save backstage -o backstage.tar
clean_image_tar() {
        rm -f backstage.tar
}
trap clean_image_tar EXIT

gzip -f backstage.tar
clean_image_gz() {
        rm -f backstage.tar.gz
}
trap clean_image_gz EXIT

ssh -i $SSH_KEY -p $SSH_PORT $SSH_USER@$BACKEND_IP "docker stop backstage" || true
ssh -i $SSH_KEY -p $SSH_PORT $SSH_USER@$BACKEND_IP "docker rm backstage" || true
ssh -i $SSH_KEY -p $SSH_PORT $SSH_USER@$BACKEND_IP "docker image rm backstage" || true
ssh -i $SSH_KEY -p $SSH_PORT $SSH_USER@$BACKEND_IP "rm -f /tmp/backstage/backstage.tar.gz /tmp/backstage/backstage.tar" || true
ssh -i $SSH_KEY -p $SSH_PORT $SSH_USER@$BACKEND_IP "mkdir -p /tmp/backstage" || true
scp -i $SSH_KEY -P $SSH_PORT backstage.tar.gz $SSH_USER@$BACKEND_IP:/tmp/backstage/backstage.tar.gz
ssh -i $SSH_KEY -p $SSH_PORT $SSH_USER@$BACKEND_IP "cd /tmp/backstage && gzip -d backstage.tar.gz && docker load -i backstage.tar"
ssh -i $SSH_KEY -p $SSH_PORT $SSH_USER@$BACKEND_IP "docker run -d --name backstage -p 7007:7007 -v /tmp/backstage:/tmp/backstage backstage"
