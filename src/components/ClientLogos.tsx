import Image from "next/image";

const clients = [
  { name: "Costa Vida", src: "/clients/costa-vida.png" },
  { name: "High Point Coffee", src: "/clients/high-point-coffee.png" },
  { name: "Cyberbacker", src: "/clients/cyberbacker.png" },
  { name: "Bajio Mexican Grill", src: "/clients/bajio.png" },
];

export function ClientLogos() {
  return (
    <div className="grid grid-cols-2 md:flex md:flex-wrap justify-center gap-x-12 gap-y-6 items-center">
      {clients.map((c) => (
        <div
          key={c.name}
          className="flex items-center justify-center h-28 md:h-28 w-full md:w-48 px-3"
        >
          <Image
            src={c.src}
            alt={`${c.name} logo — a brand The Franchisor Blueprint has worked with`}
            width={600}
            height={480}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ))}
    </div>
  );
}
