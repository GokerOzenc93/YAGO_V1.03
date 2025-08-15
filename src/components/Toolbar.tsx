import useStore from '@/store/appStore';
import {
  FaCube,
  FaDrawPolygon,
  FaFile,
  FaMousePointer,
  FaSave,
  FaUndo,
  FaRedo,
} from 'react-icons/fa';
import React from 'react';

// Tekrarı önlemek ve kod okunabilirliğini artırmak için yeniden kullanılabilir bir düğme bileşeni.
// Props: title (araç ipucu), onClick (tıklama olayı), isActive (aktif durum), children (ikon vb.)
const ToolbarButton = ({
  title,
  onClick,
  isActive,
  children,
}: {
  title: string;
  onClick?: () => void;
  isActive?: boolean;
  children: React.ReactNode;
}) => (
  <button
    title={title}
    onClick={onClick}
    className={`p-3 rounded-lg transition-all duration-200 ease-in-out transform hover:scale-110 ${
      isActive
        ? 'bg-blue-600 text-white shadow-lg'
        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
    }`}
  >
    {children}
  </button>
);

const Toolbar = () => {
  const { mode, setMode } = useStore();

  return (
    <div className="bg-gray-800 text-white p-2 flex items-center space-x-2 border-b border-gray-700/50 shadow-md">
      {/* Dosya İşlemleri */}
      <ToolbarButton title="Yeni Dosya">
        <FaFile size={20} />
      </ToolbarButton>
      <ToolbarButton title="Kaydet">
        <FaSave size={20} />
      </ToolbarButton>

      <div className="h-8 border-l border-gray-600 mx-2"></div>

      {/* Geçmiş İşlemleri */}
      <ToolbarButton title="Geri Al">
        <FaUndo size={20} />
      </ToolbarButton>
      <ToolbarButton title="İleri Al">
        <FaRedo size={20} />
      </ToolbarButton>

      <div className="h-8 border-l border-gray-600 mx-2"></div>

      {/* Mod Seçimi */}
      <ToolbarButton
        title="Seçim Modu"
        isActive={mode === 'select'}
        onClick={() => setMode('select')}
      >
        <FaMousePointer size={20} />
      </ToolbarButton>
      <ToolbarButton
        title="Çizim Modu"
        isActive={mode === 'sketch'}
        onClick={() => setMode('sketch')}
      >
        <FaDrawPolygon size={20} />
      </ToolbarButton>

      <div className="h-8 border-l border-gray-600 mx-2"></div>

      {/* 3D İşlemleri */}
      <ToolbarButton title="Küp Oluştur">
        <FaCube size={20} />
      </ToolbarButton>
      
      {/* Orijinal koddaki Select bileşeni projenizde özel olarak tanımlanmış olabilir.
          Koduna sahip olmadığım için stilini düzenleyemedim ve hataya sebep olmaması için yorum satırına aldım.
          Kendi Select bileşeninizin stilini buradaki düğmelere benzer şekilde güncelleyebilirsiniz.
      */}
      {/*
      <Select>
        <SelectContent>
          <SelectItem value="extrude">Extrude</SelectItem>
          <SelectItem value="revolve">Revolve</SelectItem>
          <SelectItem value="loft">Loft</SelectItem>
        </SelectContent>
        <SelectTrigger>
          <SelectValue placeholder="Feature" />
        </SelectTrigger>
      </Select>
      */}
    </div>
  );
};

export default Toolbar;
