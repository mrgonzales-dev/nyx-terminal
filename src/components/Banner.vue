<template>
  <header class="banner">
    <h1>Nyx</h1>
    <span class="subtitle">Terminal</span>
  </header>
</template>

<style scoped>
.banner {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  background: rgba(10, 10, 15, 0.9);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.banner h1 {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.subtitle {
  margin-left: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 400;
}
</style>
