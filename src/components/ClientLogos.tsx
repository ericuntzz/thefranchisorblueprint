import Image from "next/image";

const clients = [
  { name: "Costa Vida", src: "/clients/costa-vida.png" },
  { name: "Black Rifle Coffee Company", src: "/clients/black-rifle.png" },
  { name: "Cyberbacker", src: "/clients/cyberbacker.png" },
  { name: "Bajio Mexican Grill", src: "/clients/bajio.png" },
];

export function ClientLogos() {
  return (
    <div className="flex flex-wrap justify-center gap-x-12 gap-y-6 items-center">
      {clients.map((c) => (
        <div
          key={c.name}
          className="flex items-center justify-center h-20 md:h-24 w-40 md:w-48 px-3"
        >
          <Image
            src={c.src}
            alt={`${c.name} logo — a brand The Franchisor Blueprint has worked with`}
            width={200}
            height={100}
            className="max-h-full w-auto object-contain"
          />
        </div>
      ))}
    </div>
  );
}
