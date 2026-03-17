# FIX-14: multi-stage build per backend Spring Boot
# Stage 1 — build
FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN apk add --no-cache maven && \
    mvn package -DskipTests --no-transfer-progress

# Stage 2 — runtime
FROM eclipse-temurin:21-jre-alpine AS run

WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
