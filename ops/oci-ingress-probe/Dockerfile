FROM python:3.12-alpine
WORKDIR /probe
RUN pip install --no-cache-dir oci==2.160.3
COPY ops/oci-ingress-probe/probe.py /probe/probe.py
CMD ["python","/probe/probe.py"]
