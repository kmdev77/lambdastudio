FROM public.ecr.aws/lambda/nodejs:20 AS build
WORKDIR /app

# Install zip inside the image (Amazon Linux 2023 uses dnf)
RUN dnf -y install zip && dnf clean all

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev
COPY index.mjs ./

# Make an output dir and zip the payload for Lambda
RUN mkdir -p /out && zip -r /out/sign.zip ./*
