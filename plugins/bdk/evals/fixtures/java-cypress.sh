#!/usr/bin/env bash
# A Spring Boot app (Maven wrapper) with a static UI and a Cypress suite in e2e/ (its own npm
# package). The suite runs only through scripts/e2e.sh, which builds the jar and starts it on port
# 8081 with the `e2e` profile (in-memory H2); the default profile needs PostgreSQL. A Gatling load
# test sits in src/test/gatling and is not a check. Stacks mixed on purpose (#407).
set -euo pipefail

cat > pom.xml <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.5.6</version>
  </parent>
  <groupId>dev.example</groupId>
  <artifactId>library-loans</artifactId>
  <version>1.2.0</version>
  <properties>
    <java.version>21</java.version>
  </properties>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    <dependency>
      <groupId>org.postgresql</groupId>
      <artifactId>postgresql</artifactId>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>com.h2database</groupId>
      <artifactId>h2</artifactId>
      <scope>runtime</scope>
    </dependency>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
    <dependency>
      <groupId>io.gatling.highcharts</groupId>
      <artifactId>gatling-charts-highcharts</artifactId>
      <version>3.14.3</version>
      <scope>test</scope>
    </dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
      <plugin>
        <!-- Load test: ./mvnw gatling:test against a running app; not part of the build. -->
        <groupId>io.gatling</groupId>
        <artifactId>gatling-maven-plugin</artifactId>
        <version>4.19.0</version>
        <configuration>
          <simulationsFolder>src/test/gatling</simulationsFolder>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
XML

cat > mvnw <<'SH'
#!/bin/sh
# Maven wrapper (shortened for the fixture): runs the Maven version the project pins.
exec mvn "$@"
SH
chmod +x mvnw
mkdir -p .mvn/wrapper
cat > .mvn/wrapper/maven-wrapper.properties <<'PROPS'
distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/apache-maven-3.9.11-bin.zip
PROPS

mkdir -p src/main/java/dev/example/loans src/main/resources/static src/test/java/dev/example/loans src/test/gatling
cat > src/main/java/dev/example/loans/LoansApplication.java <<'JAVA'
package dev.example.loans;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class LoansApplication {
  public static void main(String[] args) {
    SpringApplication.run(LoansApplication.class, args);
  }
}
JAVA

cat > src/main/java/dev/example/loans/LoanController.java <<'JAVA'
package dev.example.loans;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LoanController {
  @GetMapping("/api/loans")
  public List<String> loans() {
    return List.of("Dune", "Emma");
  }
}
JAVA

cat > src/main/resources/application.properties <<'PROPS'
# Default profile: the team's PostgreSQL server.
spring.datasource.url=jdbc:postgresql://db.internal:5432/loans
spring.datasource.username=loans
spring.datasource.password=${LOANS_DB_PASSWORD}
server.port=8080
PROPS

cat > src/main/resources/application-e2e.properties <<'PROPS'
# E2E profile: in-memory H2, no external database. scripts/e2e.sh starts the app with it on 8081.
spring.datasource.url=jdbc:h2:mem:loans
spring.datasource.username=sa
spring.datasource.password=
server.port=8081
PROPS

cat > src/main/resources/static/index.html <<'HTML'
<!doctype html>
<html lang="en">
  <body>
    <h1>Library loans</h1>
    <ul id="loans"></ul>
    <script>
      fetch("/api/loans").then((r) => r.json()).then((loans) => {
        document.getElementById("loans").innerHTML = loans.map((t) => `<li>${t}</li>`).join("");
      });
    </script>
  </body>
</html>
HTML

cat > src/test/java/dev/example/loans/LoanControllerTest.java <<'JAVA'
package dev.example.loans;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class LoanControllerTest {
  @Test
  void listsLoans() {
    assertThat(new LoanController().loans()).contains("Dune");
  }
}
JAVA

cat > src/test/gatling/LoansSimulation.java <<'JAVA'
import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

import io.gatling.javaapi.core.*;

// Load test: 200 users for 5 minutes against a running app on 8080. Run by hand before a release.
public class LoansSimulation extends Simulation {
  {
    setUp(scenario("loans").exec(http("list").get("/api/loans"))
        .injectOpen(constantUsersPerSec(200).during(300)))
        .protocols(http.baseUrl("http://localhost:8080"));
  }
}
JAVA

mkdir -p e2e/cypress/e2e scripts
cat > e2e/package.json <<'JSON'
{
  "name": "library-loans-e2e",
  "private": true,
  "scripts": { "cy:run": "cypress run" },
  "devDependencies": { "cypress": "^15.3.0" }
}
JSON
cat > e2e/package-lock.json <<'JSON'
{ "name": "library-loans-e2e", "lockfileVersion": 3, "requires": true, "packages": {} }
JSON
cat > e2e/cypress.config.js <<'JS'
const { defineConfig } = require("cypress");

// The app under test is started by scripts/e2e.sh on 8081 with the e2e profile.
module.exports = defineConfig({ e2e: { baseUrl: "http://localhost:8081", supportFile: false } });
JS
cat > e2e/cypress/e2e/loans.cy.js <<'JS'
describe("loans", () => {
  it("lists the loans", () => {
    cy.visit("/");
    cy.contains("li", "Dune");
  });
});
JS

cat > scripts/e2e.sh <<'SH'
#!/usr/bin/env bash
# Builds the app, starts it on 8081 with the e2e profile (in-memory H2), runs the Cypress suite,
# and stops the app. Extra arguments go to cypress run (e.g. --spec cypress/e2e/loans.cy.js).
set -euo pipefail
./mvnw -q -DskipTests package
java -jar target/library-loans-1.2.0.jar --spring.profiles.active=e2e &
app=$!
trap 'kill $app' EXIT
for _ in $(seq 60); do curl -fs http://localhost:8081 >/dev/null && break; sleep 1; done
(cd e2e && npx cypress run "$@")
SH
chmod +x scripts/e2e.sh

cat > README.md <<'MD'
# library-loans

Lists the library's loans. `./mvnw spring-boot:run` starts it on 8080 against the team's
PostgreSQL server (set `LOANS_DB_PASSWORD`).

- Unit tests: `./mvnw test`.
- E2E: `scripts/e2e.sh` - never `npx cypress run` alone, the suite needs the app started with
  the `e2e` profile. Run `npm ci` in `e2e/` once.
- Load test: `./mvnw gatling:test` against a running app, by hand before a release.
MD

git init --quiet --initial-branch=main
git add .
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "feat: library loans"
