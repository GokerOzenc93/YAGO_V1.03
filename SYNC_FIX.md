# Edge Formula Synchronization Fix

## Problem: "Bir Adım Geriden Çalışma"

### Senaryo
1. Kullanıcı küp şeklindeki nesnenin sol ve sağ kenarlarını seçer
2. `A=100` parametresini oluşturur
3. İlk edge'in formül satırına `A` yazar ve onaylar → **Tepki vermez**
4. İkinci edge'in formül satırına `A` yazar → **İlk edge güncellenir** (bir adım geride)
5. `A=200` olarak değiştirir → **İkinci edge güncellenir** (yine bir adım geride)

### Kök Neden

React'te **iki ayrı `useEffect`** kullanılıyordu:

```typescript
// ❌ YANLIŞ YAKLAŞIM
useEffect(() => {
  // 1. Değişkenleri güncelle
  evaluator.setVariable('A', 100);
}, [customParameters]);

useEffect(() => {
  // 2. Hesapla (ama değişkenler henüz güncellenmemiş olabilir!)
  recalculateAllParameters();
}, [customParameters]);
```

Bu iki `useEffect` **race condition** oluşturuyordu. İkinci useEffect çalıştığında, birincisi henüz tamamlanmamış olabiliyordu.

## Çözüm: Senkron Güncelleme

### 1. Değişken Senkronizasyonu Fonksiyonu

```typescript
const syncFormulaVariables = useCallback(() => {
  const evaluator = formulaEvaluatorRef.current;

  // Önce tüm değişkenleri temizle
  evaluator.clearVariables();

  // Dimension değişkenlerini ekle
  evaluator.setVariable('W', convertToDisplayUnit(currentWidth));
  evaluator.setVariable('H', convertToDisplayUnit(currentHeight));
  evaluator.setVariable('D', convertToDisplayUnit(currentDepth));

  // Custom parametreleri ekle
  customParameters.forEach(param => {
    if (param.description && param.result) {
      evaluator.setVariable(param.description, parseFloat(param.result));
    }
  });

  // Edge label'larını ekle
  selectedLines.forEach(line => {
    if (line.label) {
      evaluator.setVariable(line.label, line.value);
    }
  });

  console.log('🔄 Variables synced');
}, [dependencies...]);
```

### 2. Her Hesaplamadan Önce Senkronize Et

```typescript
const recalculateAllParameters = useCallback(() => {
  // ✅ ÖNCE senkronize et
  syncFormulaVariables();

  // Sonra hesapla
  // ... hesaplama mantığı ...
}, [dependencies...]);
```

### 3. Manuel İşlemlerde de Senkronize Et

```typescript
const handleEdgeApply = (lineId: string, formula: string) => {
  // ✅ Önce senkronize et
  syncFormulaVariables();

  const evaluated = evaluateExpression(formula, `edge-${lineId}`);

  updateSelectedLineFormula(lineId, formula);

  // Sonraki frame'de tekrar senkronize et ve hesapla
  requestAnimationFrame(() => {
    syncFormulaVariables();
    recalculateAllParameters();
  });
};
```

### 4. Tek useEffect

```typescript
// ✅ DOĞRU YAKLAŞIM
useEffect(() => {
  syncFormulaVariables();  // Önce senkronize
  recalculateAllParameters();  // Sonra hesapla
}, [dependencies...]);
```

## Değişiklikler

### Önce

```
User Action → useEffect 1 (async) → useEffect 2 (async)
                ↓                       ↓
            Update Vars              Calculate
                                    (eski değerlerle!)
```

### Sonra

```
User Action → syncFormulaVariables() → recalculateAllParameters()
                     ↓ (sync)                ↓ (sync)
                Update Vars              Calculate
                                      (güncel değerlerle!)
```

## Test Senaryosu

### Artık Çalışan Davranış

1. ✅ `A=100` parametresi oluştur
2. ✅ İlk edge'e `A` formülü yaz ve onayla → **Hemen güncellenir**
3. ✅ İkinci edge'e `A` formülü yaz ve onayla → **Hemen güncellenir**
4. ✅ `A=200` olarak değiştir → **Her iki edge anında güncellenir**
5. ✅ İlk edge'e `A+50` yaz → **150 sonucu ile hemen güncellenir**
6. ✅ İkinci edge'e `A*2` yaz → **200 sonucu ile hemen güncellenir**

### Bağımlı Formüller

1. ✅ Edge1: `A` → 100
2. ✅ Edge2: `B` → Edge1 değeri kullanılabilir
3. ✅ Edge3: `B+50` → Edge2 değeri kullanılabilir
4. ✅ Değişiklikler cascade olarak propagate olur

## Debug Log'ları

Artık her senkronizasyonda console'da şunu göreceksiniz:

```
🔄 Formula variables synced: W=500, H=500, D=500, A=100
✅ Edge dynamic updates completed in 2 iterations
```

## Performans İyileştirmeleri

1. **useCallback** kullanımı: Gereksiz yeniden render'lar engellendi
2. **requestAnimationFrame**: UI thread'i bloke etmeden güncelleme
3. **Batch updates**: Tüm değişiklikler bir arada uygulanıyor
4. **Early termination**: Değişiklik yoksa döngü hemen sonlanıyor

## Ek İyileştirmeler

### clearVariables() Eklendi

Her senkronizasyonda eski değişkenleri temizleyerek "ghost variables" önlendi:

```typescript
evaluator.clearVariables();  // Eski A, B, C değişkenlerini temizle
evaluator.setVariable('A', 100);  // Yeni değerleri ekle
```

### requestAnimationFrame Kullanımı

State güncellemelerinin DOM'a yansıması için bir frame bekleniyor:

```typescript
requestAnimationFrame(() => {
  syncFormulaVariables();  // Güncel state ile çalış
  recalculateAllParameters();
});
```

## Sonuç

✅ **Race condition çözüldü**
✅ **Senkron güncelleme garantisi**
✅ **Anında tepki**
✅ **Bağımlı formüller doğru çalışıyor**
✅ **Debug kolaylığı**

Artık edge formülleri tam zamanında, doğru değerlerle hesaplanıyor!
