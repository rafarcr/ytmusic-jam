import { HomeActions } from "@/components/home-actions";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium tracking-[0.2em] text-[#ff2d3a] uppercase">Jam</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Fila aberta para a festa</h1>
      <p className="mt-4 text-base leading-7 text-white/70">
        Esta aba é a caixa de som. Quem for pedir música escaneia o QR e escolhe no catálogo do
        YouTube, direto no navegador do celular. Cada pedido entra na hora e toca aqui, em ordem.
      </p>
      <p className="mt-3 text-base leading-7 text-white/70">
        O som sai deste navegador. O app do YouTube Music no iPhone não recebe essa fila.
      </p>
      <div className="mt-8">
        <HomeActions />
      </div>
    </main>
  );
}
