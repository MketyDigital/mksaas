import json, time, urllib.request
import oci

def metadata(path):
    req=urllib.request.Request(
        "http://169.254.169.254/opc/v2/"+path.lstrip("/"),
        headers={"Authorization":"Bearer Oracle"},
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.load(r)

try:
    instance=metadata("instance/")
    vnics=metadata("vnics/")
    print("MKETY_OCI_IMDS_OK=true", flush=True)
    print("MKETY_OCI_REGION="+str(instance.get("canonicalRegionName") or instance.get("region") or ""), flush=True)
    print("MKETY_OCI_VNIC_METADATA_COUNT="+str(len(vnics) if isinstance(vnics,list) else 0), flush=True)
except Exception as exc:
    print("MKETY_OCI_IMDS_OK=false", flush=True)
    print("MKETY_OCI_IMDS_ERROR="+type(exc).__name__, flush=True)
    time.sleep(300)
    raise SystemExit(1)

try:
    signer=oci.auth.signers.InstancePrincipalsSecurityTokenSigner()
    print("MKETY_OCI_INSTANCE_PRINCIPAL_SIGNER=true", flush=True)
except Exception as exc:
    print("MKETY_OCI_INSTANCE_PRINCIPAL_SIGNER=false", flush=True)
    print("MKETY_OCI_SIGNER_ERROR="+type(exc).__name__, flush=True)
    time.sleep(300)
    raise SystemExit(2)

try:
    network=oci.core.VirtualNetworkClient(config={}, signer=signer)
    primary=(vnics[0] if isinstance(vnics,list) and vnics else {})
    vnic_id=str(primary.get("vnicId") or "")
    if not vnic_id:
        raise RuntimeError("missing_vnic_id")
    vnic=network.get_vnic(vnic_id).data
    subnet=network.get_subnet(vnic.subnet_id).data
    nsg_ids=list(getattr(vnic,"nsg_ids",None) or [])
    security_list_ids=list(getattr(subnet,"security_list_ids",None) or [])
    for nsg_id in nsg_ids:
        network.get_network_security_group(nsg_id)
    for sl_id in security_list_ids:
        network.get_security_list(sl_id)
    print("MKETY_OCI_NETWORK_READ=true", flush=True)
    print("MKETY_OCI_NSG_COUNT="+str(len(nsg_ids)), flush=True)
    print("MKETY_OCI_SECURITY_LIST_COUNT="+str(len(security_list_ids)), flush=True)
except Exception as exc:
    print("MKETY_OCI_NETWORK_READ=false", flush=True)
    print("MKETY_OCI_NETWORK_ERROR="+type(exc).__name__, flush=True)
    try:
        status=getattr(exc,"status",None)
        if status is not None:
            print("MKETY_OCI_NETWORK_STATUS="+str(status), flush=True)
    except Exception:
        pass

time.sleep(300)
