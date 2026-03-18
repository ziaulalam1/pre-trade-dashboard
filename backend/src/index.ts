import express, { Request, Response } from "express";
import cors from "cors";
import { validateInput, price, priceChain, OptionInput } from "./blackScholes";

const app = express();
app.use(express.json());
app.use(cors({ origin: "http://localhost:5173" }));

app.post("/price", (req: Request, res: Response) => {
  const input: OptionInput = req.body;
  const err = validateInput(input);
  if (err) {
    res.status(400).json({ error: err });
    return;
  }
  try {
    res.json(price(input));
  } catch (e) {
    res.status(500).json({ error: "Internal error" });
  }
});

app.post("/chain", (req: Request, res: Response) => {
  const inputs: OptionInput[] = req.body;
  try {
    res.json(priceChain(inputs));
  } catch (e) {
    res.status(500).json({ error: "Internal error" });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
