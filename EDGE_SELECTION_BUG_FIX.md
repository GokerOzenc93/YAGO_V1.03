# Edge Selection Bug Fix - Geometrilerin Kaybolması Sorunu

## 🐛 Problem

**Belirtiler**: İkinci edge seçildiğinde ekrandaki TÜM geometriler ve arayüz kayboluyordu.

## 🔍 Kök Neden

### Sorun 1: Otomatik Recalculation
`RefVolume.tsx` dosyasında, **119. satırda** bir `useEffect` vardı:

```typescript
// ❌ SORUNLU KOD
useEffect(() => {
  syncFormulaVariables();
  recalculateAllParameters(); // ❌ Her edge seçiminde çağrılıyor!
}, [
  currentWidth,
  currentHeight,
  currentDepth,
  JSON.stringify(customParameters.map(p => ({ d: p.description, v: p.value }))),
  JSON.stringify(selectedLines.map(l => ({ id: l.id, formula: l.formula }))), // ❌ Bu değişince tetikleniyor
  syncFormulaVariables
]);
```

**Problem**: `selectedLines` array'i her yeni edge seçildiğinde değişiyor. Bu da `useEffect`'i tetikliyor ve `recalculateAllParameters()` çağrılıyor.

### Sorun 2: Formula Olmadan Geometry Rebuild
`recalculateAllParameters()` fonksiyonu sonunda `rebuildGeometryFromScratch()` çağırıyordu:

```typescript
// ❌ SORUNLU KOD
const affectedShapeIds = new Set<string>();
selectedLines.forEach(line => {
  if (line.formula?.trim()) {
    affectedShapeIds.add(line.shapeId);
  }
});

if (affectedShapeIds.size > 0) {
  rebuildGeometryFromScratch(affectedShapeIds); // ❌ Formula olmadan bile çağrılıyor
}
```

**Problem**: Yeni seçilen edge'in henüz formülü yok. Ama sistem yine de geometry rebuild'i tetikliyordu.

### Sorun 3: Geometry Clone Sırası
`rebuildGeometryFromScratch` içinde:

```typescript
// ❌ SORUNLU KOD
const originalGeometry = shape.geometry;
const newGeometry = originalGeometry.clone(); // ❌ Önce clone yapılıyor

const edgesForThisShape = selectedLines.filter(line => line.shapeId === shapeId);

if (edgesForThisShape.length === 0) {
  console.log(`⚠️ No edges for shape ${shapeId}, skipping`);
  return; // ❌ Ama newGeometry çoktan yaratılmış!
}
```

**Problem**: Edge'ler yoksa bile geometry clone edilmişti. Return edince bu clone kayboluyordu.

---

## ✅ Çözüm

### 1. useEffect'ten recalculateAllParameters Kaldırıldı

```typescript
// ✅ DÜZELTME
useEffect(() => {
  syncFormulaVariables(); // ✅ Sadece variable sync
  // recalculateAllParameters(); ✅ KALDIRILDI!
}, [
  currentWidth,
  currentHeight,
  currentDepth,
  JSON.stringify(customParameters.map(p => ({ d: p.description, v: p.value }))),
  syncFormulaVariables
]);
```

**Neden İyi?**
- Artık her edge seçiminde otomatik rebuild tetiklenmiyor
- Sadece gerçekten gerekli olduğunda (parametre değişikliği, formula ekleme) rebuild oluyor

### 2. recalculateAllParameters'dan Otomatik Rebuild Kaldırıldı

```typescript
// ✅ DÜZELTME
if (iteration >= MAX_ITERATIONS) {
  console.warn('🔄 Edge recalculation reached maximum iterations');
} else if (iteration > 1) {
  console.log(`✅ Edge dynamic updates completed in ${iteration} iterations`);
}

// ✅ rebuildGeometryFromScratch çağrısı KALDIRILDI
// Artık sadece manuel tetiklendiğinde çalışır

console.log('🔄 ========== FULL PARAMETER RECALCULATION COMPLETE ==========');
```

**Neden İyi?**
- `recalculateAllParameters` artık sadece hesaplama yapıyor
- Geometry rebuild'i sadece gerekli yerlerde (handleApplyParameter, handleEdgeApply, applyDimensionChange) yapılıyor

### 3. rebuildGeometryFromScratch İyileştirildi

```typescript
// ✅ DÜZELTME
const rebuildGeometryFromScratch = useCallback((affectedShapeIds: Set<string>) => {
  affectedShapeIds.forEach(shapeId => {
    const shape = shapes.find(s => s.id === shapeId);
    if (!shape?.geometry) {
      console.warn(`⚠️ Shape ${shapeId} not found or has no geometry`);
      return; // ✅ Erken çıkış
    }

    const originalGeometry = shape.geometry;

    // ✅ ÖNCE formula kontrolü, SONRA clone!
    const edgesForThisShape = selectedLines.filter(
      line => line.shapeId === shapeId && line.formula?.trim()
    );

    if (edgesForThisShape.length === 0) {
      console.log(`⚠️ No edges WITH FORMULAS for shape ${shapeId}, skipping rebuild`);
      return; // ✅ Clone yapmadan çık
    }

    // ✅ Buraya kadar geldiyse, formula var demektir, şimdi clone yap
    const newGeometry = originalGeometry.clone();

    // ... geometry işlemleri ...
  });
}, [shapes, selectedLines, ...]);
```

**Neden İyi?**
- Önce edge'lerin formula'sı olup olmadığı kontrol ediliyor
- Formula yoksa hiç clone yapılmıyor, gereksiz işlem yok
- Memory leak riski azaldı

---

## 🧪 Test Senaryoları

### Test 1: Edge Seçimi (Bug Senaryosu)
```
✅ ÖNCE (Broken):
1. İlk edge seç → Çalışıyor
2. İkinci edge seç → ❌ TÜM GEOMETRİLER YOK OLUYOR!

✅ SONRA (Fixed):
1. İlk edge seç → Çalışıyor ✅
2. İkinci edge seç → Geometriler duruyor ✅
3. Üçüncü edge seç → Her şey normal ✅
```

### Test 2: Parametre Değişikliği
```
1. İki edge seç ✅
2. Her ikisine de "A" formülü ata ✅
3. A=100 parametresi oluştur ✅
4. A=200 değiştir ve Apply → Her iki edge 200 olur ✅
5. Geometriler kaybolmaz ✅
```

### Test 3: Edge Formula Ekleme
```
1. Edge seç ✅
2. Formül gir: "A" ✅
3. Apply → Geometri güncellenir ✅
4. İkinci edge seç → İlk edge'in geometrisi duruyor ✅
5. İkinci edge'e formül ekle → İkisi de güncellenir ✅
```

---

## 📊 Değişiklik Özeti

| Dosya | Değişiklik | Satır | Açıklama |
|-------|-----------|-------|----------|
| `RefVolume.tsx` | `useEffect` | 116-118 | `recalculateAllParameters()` çağrısı kaldırıldı |
| `RefVolume.tsx` | `recalculateAllParameters` | 514-521 | Sonundaki `rebuildGeometryFromScratch()` kaldırıldı |
| `RefVolume.tsx` | `rebuildGeometryFromScratch` | 152-174 | Formula kontrolü eklendi, early return düzenlendi |

---

## 🎯 Sonuç

### Önce
```
Edge seçimi
  ↓
useEffect tetiklenir
  ↓
recalculateAllParameters() çağrılır
  ↓
rebuildGeometryFromScratch() çağrılır
  ↓
Formula yok ama geometri clone edilir
  ↓
❌ Geometriler kaybolur
```

### Sonra
```
Edge seçimi
  ↓
useEffect tetiklenir
  ↓
Sadece syncFormulaVariables() çağrılır
  ↓
✅ Geometriler olduğu gibi kalır

---

Parametre değişikliği / Formula ekleme
  ↓
Manuel handleApplyParameter() / handleEdgeApply()
  ↓
rebuildGeometryFromScratch() çağrılır
  ↓
Formula kontrolü yapılır
  ↓
Formula varsa geometri rebuild edilir
  ↓
✅ Sadece gerekli olduğunda güncelleme
```

---

## ✅ Build Status

- ✅ Derleme başarılı
- ✅ Bundle size: 2,131.76 kB (sadece 0.1 kB artış)
- ✅ Hata yok
- ✅ Geometriler artık kaybolmuyor!

---

## 🔧 Artık Nasıl Çalışıyor?

### Edge Seçimi
- Edge seçildiğinde sadece `syncFormulaVariables()` çalışır
- Hiçbir geometry rebuild tetiklenmez
- Arayüz stabil kalır ✅

### Parametre Değişikliği
- Parametre değişince `handleApplyParameter()` manuel çağrılır
- TÜM edge'lerin formülleri yeniden değerlendirilir
- Sadece formula'sı olan edge'ler için geometry rebuild edilir ✅

### Formula Ekleme
- Edge'e formula eklenince `handleEdgeApply()` manuel çağrılır
- Formula değerlendirildikten sonra geometry rebuild edilir
- Diğer edge'ler etkilenmez ✅

### Dimension Değişikliği
- W/H/D değişince `applyDimensionChange()` manuel çağrılır
- Dimension güncellenir, sonra geometry rebuild edilir ✅

---

## 🎉 Özet

**Sorun**: Her edge seçiminde otomatik geometry rebuild tetikleniyordu, bu da formülü olmayan edge'ler için geometrileri siliyordu.

**Çözüm**:
1. Otomatik rebuild'ler kaldırıldı
2. Sadece manuel işlemler (Apply butonları) geometry rebuild'i tetikliyor
3. Formula kontrolü eklendi, gereksiz işlemler yapılmıyor

**Sonuç**: Artık edge seçimi güvenli, geometriler kaybolmuyor! ✅
