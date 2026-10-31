"""Verify an IPA against the operator's actual filed iOS identity. Never reads private keys."""
from pathlib import Path
import argparse
import hashlib
import json
import plistlib
import subprocess
import tempfile
import zipfile


def run(args, data=None):
    result = subprocess.run(args, input=data, capture_output=True)
    if result.returncode:
        raise ValueError(f"Verification command failed: {args[0]}")
    return result.stdout


def verify(ipa, reference):
    expected = json.loads(reference.read_text())
    with tempfile.TemporaryDirectory(prefix="swod-filed-ipa-") as directory:
        root = Path(directory).resolve()
        with zipfile.ZipFile(ipa) as package:
            for entry in package.infolist():
                if not (root / entry.filename).resolve().is_relative_to(root):
                    raise ValueError("Invalid archive path")
            package.extractall(root)
        apps = list((root / "Payload").glob("*.app"))
        if len(apps) != 1:
            raise ValueError("Expected one application")
        app = apps[0]
        info = plistlib.loads((app / "Info.plist").read_bytes())
        run(["codesign", "--verify", "--deep", "--strict", str(app)])
        prefix = str(root / "certificate-")
        run(["codesign", "-d", "--extract-certificates=" + prefix, str(app)])
        certificate = Path(prefix + "0")
        sha1 = hashlib.sha1(certificate.read_bytes()).hexdigest().upper()
        pem = run(["openssl", "x509", "-inform", "DER", "-in", str(certificate), "-pubkey", "-noout"])
        public = run(["openssl", "rsa", "-pubin", "-RSAPublicKey_out", "-outform", "DER"], pem).hex().upper()
        profile = plistlib.loads(run(["security", "cms", "-D", "-i", str(app / "embedded.mobileprovision")]))
        entitlements = profile["Entitlements"]
        signed_entitlements = plistlib.loads(run(["codesign", "-d", "--entitlements", ":-", str(app)]))
        checks = {
            "signedApplicationIdentifier": signed_entitlements.get("application-identifier") == expected["teamId"] + "." + expected["bundleId"],
            "pushEntitlementMatchesProfile": "aps-environment" not in entitlements or signed_entitlements.get("aps-environment") == entitlements["aps-environment"],
            "bundleID": info["CFBundleIdentifier"] == expected["bundleId"],
            "certificateSHA1": sha1 == expected["sha1"].replace(":", "").upper(),
            "publicKey": public == expected["publicKey"].replace(" ", "").upper(),
            "teamID": profile["TeamIdentifier"] == [expected["teamId"]],
            "profileIdentity": entitlements["application-identifier"] == expected["teamId"] + "." + expected["bundleId"],
            "distributionProfile": not entitlements.get("get-task-allow", False)
                and not profile.get("ProvisionedDevices") and not profile.get("ProvisionsAllDevices", False),
            "filingNumber": info.get("SWODAppFilingNumber") == expected["filingNumber"],
        }
        return {"passed": all(checks.values()), "checks": checks,
                "bundleID": info["CFBundleIdentifier"], "version": info["CFBundleShortVersionString"],
                "build": info["CFBundleVersion"], "certificateSHA1": sha1,
                "ipaSHA256": hashlib.sha256(ipa.read_bytes()).hexdigest(),
                "reference": str(reference.resolve()), "filingChanged": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ipa", type=Path)
    parser.add_argument("--filing-reference", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        report = verify(args.ipa, args.filing_reference)
    except (ValueError, OSError, KeyError, zipfile.BadZipFile) as error:
        report = {"passed": False, "error": str(error)}
    text = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(text)
    print(text, end="")
    raise SystemExit(0 if report["passed"] else 2)
