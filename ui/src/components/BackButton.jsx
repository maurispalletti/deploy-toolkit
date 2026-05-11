import Button from "./Button.jsx";

export default function BackButton({ onClick }) {
  return <Button variant="ghost" onClick={onClick}>← Back</Button>;
}
