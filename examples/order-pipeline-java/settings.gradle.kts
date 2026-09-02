plugins {
    // Lets Gradle download a matching JDK when the machine building this doesn't already
    // have the toolchain version declared in build.gradle.kts. CI installs JDK 21 itself,
    // so this is a convenience for local builds on a different JDK.
    id("org.gradle.toolchains.foojay-resolver-convention") version "0.8.0"
}

rootProject.name = "order-pipeline-java"
