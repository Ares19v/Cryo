# .NET Build Stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Copy and restore
COPY Cryo.csproj ./
RUN dotnet restore

# Copy all and build
COPY . ./
RUN dotnet build -c Release -o /app/build
