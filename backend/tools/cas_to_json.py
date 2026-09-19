"""Parse a CAMS/KFintech Consolidated Account Statement locally with casparser.

Usage: python cas_to_json.py <statement.pdf>   (password read from the CAS_PASSWORD env var,
never from argv, so it doesn't show up in the process list). Prints JSON with only the
fields the app needs — investor name, PAN, address and email are dropped here.
"""
import json
import os
import sys

import casparser


def main() -> None:
    data = casparser.read_cas_pdf(sys.argv[1], os.environ.get("CAS_PASSWORD", ""), output="dict")
    schemes = []
    for folio in data.get("folios", []):
        for s in folio.get("schemes", []):
            val = s.get("valuation") or {}
            schemes.append({
                "name": s.get("scheme"),
                "amfi": s.get("amfi"),
                "isin": s.get("isin"),
                "type": s.get("type"),
                "value": float(val.get("value") or 0),
                "nav": float(val.get("nav") or 0),
                "valuationDate": str(val.get("date") or ""),
                "transactions": [
                    {"date": str(t.get("date")), "amount": float(t.get("amount") or 0), "type": str(t.get("type") or "")}
                    for t in s.get("transactions", [])
                    if t.get("amount") not in (None, 0)
                ],
            })
    period = data.get("statement_period") or {}
    print(json.dumps({"statementTo": str(period.get("to", "")), "schemes": schemes}))


if __name__ == "__main__":
    main()
